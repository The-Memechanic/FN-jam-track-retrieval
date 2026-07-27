"use client";

import { useEffect, useMemo, useState } from "react";
import Fuse from "fuse.js";
import type { TrackRow } from "@/lib/fetchTracks";
import { TRACK_COLUMNS } from "@/lib/fetchTracks";

const SORT_OPTIONS = [
  { value: "relevancy", label: "Relevancy" },
  { value: "releaseYear", label: "Release year" },
  { value: "bpm", label: "BPM" },
  { value: "added", label: "Added" },
] as const;

type SortOption = (typeof SORT_OPTIONS)[number]["value"];

const compareString = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

const parseNumber = (value?: number | null) => (typeof value === "number" ? value : NaN);

const parseDateValue = (value?: string): number | null => {
  const date = new Date(value ?? "");
  return Number.isNaN(date.getTime()) ? null : date.getTime();
};

const compareRows = (a: TrackRow, b: TrackRow, sortOption: SortOption) => {
  switch (sortOption) {
    case "releaseYear": {
      const na = parseNumber(a.releaseYear);
      const nb = parseNumber(b.releaseYear);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      if (!Number.isNaN(na)) return -1;
      if (!Number.isNaN(nb)) return 1;
      return compareString(a.song, b.song);
    }
    case "bpm": {
      const na = parseNumber(a.bpm);
      const nb = parseNumber(b.bpm);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      if (!Number.isNaN(na)) return -1;
      if (!Number.isNaN(nb)) return 1;
      return compareString(a.song, b.song);
    }
    case "added": {
      const da = parseDateValue(a.added);
      const db = parseDateValue(b.added);
      if (da !== null && db !== null) return da - db;
      if (da !== null) return -1;
      if (db !== null) return 1;
      return compareString(a.added ?? "", b.added ?? "");
    }
    default:
      return 0;
  }
};

function getUniqueValues(rows: TrackRow[], key: keyof TrackRow) {
  const map = new Map<string, string>();
  rows.forEach((row) => {
    const raw = Array.isArray(row[key])
      ? (row[key] as string[]).join(", ")
      : String(row[key] ?? "").trim();

    if (!raw) return;
    const normalized = raw.toLowerCase();
    if (!map.has(normalized)) map.set(normalized, raw);
  });
  return Array.from(map.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
  );
}

const equalsNormalized = (value: string, option: string) =>
  value.trim().toLowerCase() === option.trim().toLowerCase();

export default function SearchClient() {
  const [query, setQuery] = useState("");
  const [genreFilter, setGenreFilter] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>("relevancy");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<TrackRow[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const PAGE_SIZE = 10;

  useEffect(() => {
    async function loadRows() {
      setLoading(true);
      try {
        const res = await fetch("/api/data");
        if (!res.ok) {
          throw new Error(`Failed to load track data: ${res.status}`);
        }

        const data = await res.json();
        setRows(data.rows ?? []);
        setFetchedAt(data.fetchedAt ?? new Date().toISOString());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    loadRows();
  }, []);

  const columns = useMemo(() => TRACK_COLUMNS, []);
  const genreOptions = useMemo(() => getUniqueValues(rows, "genres"), [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      return (
        genreFilter.length === 0 ||
        genreFilter.some((filterValue) =>
          row.genres.some((genre) => equalsNormalized(genre, filterValue))
        )
      );
    });
  }, [genreFilter, rows]);

  const fuse = useMemo(() => {
    return new Fuse(filteredRows, {
      keys: ["song", "artist", "album", "devName"],
      threshold: 0.35,
      ignoreLocation: true,
    });
  }, [filteredRows]);

  const searchedRows = useMemo(() => {
    if (!query.trim()) return filteredRows;
    return fuse.search(query).map((r) => r.item);
  }, [query, fuse, filteredRows]);

  const results = useMemo(() => {
    if (sortOption === "relevancy") return searchedRows;

    const sorted = [...searchedRows].sort((a, b) => compareRows(a, b, sortOption));
    return sortDirection === "asc" ? sorted : sorted.reverse();
  }, [searchedRows, sortOption, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const paginatedResults = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return results.slice(start, start + PAGE_SIZE);
  }, [page, results]);

  useEffect(() => {
    setPage(1);
  }, [query, genreFilter, sortOption, sortDirection]);

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto rounded-lg border border-neutral-200 bg-white p-6 text-center text-neutral-600">
        Loading Fortnite track data…
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-4xl mx-auto rounded-lg border border-red-200 bg-red-50 text-red-700 p-6 text-sm">
        Couldn&apos;t load the tracks: {error}
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Search</label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by song or artist…"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-neutral-700">Genres</p>
              <div className="grid gap-2">
                {genreOptions.map((option) => (
                  <label key={option} className="inline-flex items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={genreFilter.includes(option)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...genreFilter, option]
                          : genreFilter.filter((value) => value !== option);
                        setGenreFilter(next);
                      }}
                      className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>

          </div>
        </aside>

        <section className="space-y-6">
          <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span className="font-medium text-neutral-700">Sort:</span>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {sortOption !== "relevancy" ? (
                <button
                  type="button"
                  onClick={() => setSortDirection((current) => (current === "asc" ? "desc" : "asc"))}
                  className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1 text-sm text-neutral-700 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                >
                  {sortDirection === "asc" ? "Ascending" : "Descending"}
                </button>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 text-sm text-neutral-500 sm:flex-row sm:items-center">
              <span>
                {results.length} of {filteredRows.length} track{filteredRows.length === 1 ? "" : "s"}
              </span>
              <span>Data last fetched {fetchedAt ? new Date(fetchedAt).toLocaleString() : "unknown"}</span>
            </div>
          </div>

          {totalPages > 1 ? (
            <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-700 sm:flex-row">
              <p>
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}

          {results.length === 0 ? (
            <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center text-neutral-500">
              No matches. Try a different search term.
            </div>
          ) : (
            <>
              <div className="grid gap-3">
                {paginatedResults.map((row, i) => (
                  <div
                    key={(page - 1) * PAGE_SIZE + i}
                    className="rounded-lg border border-neutral-200 bg-white p-4 hover:border-neutral-400 transition-colors"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-neutral-900">{row.song || "Untitled track"}</p>
                          <p className="text-sm text-neutral-600">{row.artist || "Unknown artist"}</p>
                        </div>
                        {row.album ? (
                          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-neutral-600">
                            {row.album}
                          </span>
                        ) : null}
                      </div>
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                        {columns
                          .filter((col) => {
                            if (col.key === "song" || col.key === "artist") return false;

                            switch (col.key) {
                              case "releaseYear":
                                return row.releaseYear != null;
                              case "bpm":
                                return row.bpm != null;
                              case "key":
                                return Boolean(row.key || row.mode);
                              case "duration":
                                return Boolean(row.duration);
                              case "genres":
                                return row.genres.length > 0;
                              case "added":
                                return Boolean(row.added);
                              case "album":
                                return Boolean(row.album);
                              case "difficulty":
                                return Boolean(row.difficulty);
                              default:
                                return false;
                            }
                          })
                          .map((col) => {
                            const value = row[col.key as keyof TrackRow];
                            let displayValue: string | number | null = null;

                            if (col.key === "releaseYear") {
                              displayValue = row.releaseYear;
                            } else if (col.key === "bpm") {
                              displayValue = row.bpm;
                            } else if (col.key === "key") {
                              displayValue = row.key && row.mode ? `${row.key} ${row.mode}` : row.key || row.mode || null;
                            } else if (col.key === "duration") {
                              displayValue = row.duration ? `${row.duration}s` : null;
                            } else if (col.key === "genres") {
                              displayValue = row.genres.length ? row.genres.join(", ") : null;
                            } else if (col.key === "added") {
                              displayValue = row.added ? new Date(row.added).toLocaleDateString() : null;
                            } else if (typeof value === "string") {
                              displayValue = value || null;
                            }

                            if (displayValue === null || displayValue === "") return null;

                            return (
                              <div key={col.key} className="flex gap-2">
                                <dt className="font-medium text-neutral-500 shrink-0">{col.label}:</dt>
                                <dd className="text-neutral-900 break-words">{displayValue}</dd>
                              </div>
                            );
                          })}
                      </dl>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 ? (
                <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-700 sm:flex-row">
                  <p>
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={page === 1}
                      className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                      disabled={page === totalPages}
                      className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
