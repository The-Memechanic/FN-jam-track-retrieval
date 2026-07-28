"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Fuse from "fuse.js";
import type { TrackRow } from "@/lib/fetchTracks";
import { getTrackSlug } from "@/lib/trackSlug";

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

const equalsNormalized = (value: string, option: string) =>
  value.trim().toLowerCase() === option.trim().toLowerCase();

export default function SearchClient() {
  const [query, setQuery] = useState("");
  const [genreFilter, setGenreFilter] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>("added");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<TrackRow[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const PAGE_SIZE = 20;

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
      keys: ["song", "artist"],
      threshold: 0.15,
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
      <div className="mx-auto w-full max-w-4xl rounded-lg border border-neutral-200 bg-white p-6 text-center text-neutral-600 shadow-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
        Loading Fortnite track data…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-4xl rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
        Couldn&apos;t load the tracks: {error}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Search</label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by song or artist…"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
            </div>
          </div>
        </aside>

        <section className="space-y-6">
          <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-800 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">Sort:</span>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
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
                  className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1 text-sm text-neutral-700 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                >
                  {sortDirection === "asc" ? "Ascending" : "Descending"}
                </button>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 text-sm text-neutral-500 dark:text-neutral-400 sm:flex-row sm:items-center">
              <span>
                {results.length} of {filteredRows.length} track{filteredRows.length === 1 ? "" : "s"}
              </span>
              <span>Data last fetched {fetchedAt ? new Date(fetchedAt).toLocaleString() : "unknown"}</span>
            </div>
          </div>

          {totalPages > 1 ? (
            <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-700 shadow-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 sm:flex-row">
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
                  Go Back
                </button>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                >
                  Keep Going
                </button>
              </div>
            </div>
          ) : null}

          {results.length === 0 ? (
            <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center text-neutral-500 shadow-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
              No matches. Try a different search term.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {paginatedResults.map((row, i) => (
                  <Link
                    key={(page - 1) * PAGE_SIZE + i}
                    href={`/track/${getTrackSlug(row)}`}
                    className="group flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3 transition-colors hover:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:border-neutral-400"
                  >
                    <div className="aspect-square w-full overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-800">
                      {row.albumArt ? (
                        <img
                          src={row.albumArt}
                          alt={row.song || "Album art"}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform group-hover:scale-110"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-neutral-400 dark:text-neutral-500">
                          No image
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        {row.song || "Untitled track"}
                      </p>
                      <p className="truncate text-xs text-neutral-600 dark:text-neutral-400">
                        {row.artist || "Unknown artist"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>

              {totalPages > 1 ? (
                <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-700 shadow-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 sm:flex-row">
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
