"use client";

import { useEffect, useMemo, useState } from "react";
import Fuse from "fuse.js";
import type { SheetRow } from "@/lib/fetchSheet";
import { SHEET_COLUMNS } from "@/lib/fetchSheet";

const SORT_OPTIONS = [
  { value: "relevancy", label: "Relevancy" },
  { value: "announce_date", label: "Announce Date" },
  { value: "id", label: "ID" },
  { value: "bpm", label: "BPM" },
  { value: "earliest_development_time", label: "Earliest Development Time" },
] as const;

type SortOption = (typeof SORT_OPTIONS)[number]["value"];

const normalizeValue = (value?: string) => value?.trim().toLowerCase() ?? "";

const parseNumber = (value?: string) => {
  const numeric = Number((value ?? "").replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(numeric) ? numeric : NaN;
};

const parseDateValue = (value?: string): number | null => {
  const date = new Date(value ?? "");
  return isNaN(date.getTime()) ? null : date.getTime();
};

const compareString = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

const compareRows = (a: SheetRow, b: SheetRow, sortOption: SortOption) => {
  switch (sortOption) {
    case "announce_date": {
      const da = parseDateValue(a.announce_date);
      const db = parseDateValue(b.announce_date);
      if (da !== null && db !== null) return da - db;
      if (da !== null) return -1;
      if (db !== null) return 1;
      return compareString(a.announce_date ?? "", b.announce_date ?? "");
    }
    case "id": {
      const na = parseNumber(a.id);
      const nb = parseNumber(b.id);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      if (!Number.isNaN(na)) return -1;
      if (!Number.isNaN(nb)) return 1;
      return compareString(a.id ?? "", b.id ?? "");
    }
    case "bpm": {
      const na = parseNumber(a.bpm);
      const nb = parseNumber(b.bpm);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      if (!Number.isNaN(na)) return -1;
      if (!Number.isNaN(nb)) return 1;
      return compareString(a.bpm ?? "", b.bpm ?? "");
    }
    case "earliest_development_time": {
      const da = parseDateValue(a.earliest_development_time);
      const db = parseDateValue(b.earliest_development_time);
      if (da !== null && db !== null) return da - db;
      if (da !== null) return -1;
      if (db !== null) return 1;
      return compareString(
        a.earliest_development_time ?? "",
        b.earliest_development_time ?? ""
      );
    }
    default:
      return 0;
  }
};

function getUniqueValues(rows: SheetRow[], key: keyof SheetRow) {
  const map = new Map<string, string>();
  rows.forEach((row) => {
    const raw = (row[key] ?? "").trim();
    if (!raw) return;
    const normalized = raw.toLowerCase();
    if (normalized === "num") return;
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
  const [modeFilter, setModeFilter] = useState<string[]>([]);
  const [keyFilter, setKeyFilter] = useState<string[]>([]);
  const [stateFilter, setStateFilter] = useState<string[]>(["Released"]);
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>("relevancy");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<SheetRow[]>([]);
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
          throw new Error(`Failed to load sheet data: ${res.status}`);
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

  const columns = useMemo(() => SHEET_COLUMNS, []);
  const modeOptions = useMemo(() => getUniqueValues(rows, "mode"), [rows]);
  const keyOptions = useMemo(() => getUniqueValues(rows, "key"), [rows]);
  const stateOptions = useMemo(() => getUniqueValues(rows, "state"), [rows]);
  const sourceOptions = useMemo(() => {
    const uniqueSources = getUniqueValues(rows, "source");
    return ["Battle Pass (Any)", "Music Pass (Any)", ...uniqueSources];
  }, [rows]);

  const isSourceMatch = (sourceValue: string, filterValue: string) => {
    const normalizedSource = sourceValue.trim().toLowerCase();
    const normalizedFilter = filterValue.trim().toLowerCase();
    if (normalizedFilter === "battle pass (any)") {
      return normalizedSource.includes("battle pass");
    }
    if (normalizedFilter === "music pass (any)") {
      return normalizedSource.includes("music pass");
    }
    return normalizedSource === normalizedFilter;
  };

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const modeMatch =
        modeFilter.length === 0 ||
        modeFilter.some((filterValue) => equalsNormalized(row.mode, filterValue));
      const keyMatch =
        keyFilter.length === 0 ||
        keyFilter.some((filterValue) => equalsNormalized(row.key, filterValue));
      const stateMatch =
        stateFilter.length === 0 ||
        stateFilter.some((filterValue) => equalsNormalized(row.state, filterValue));
      const sourceMatch =
        sourceFilter.length === 0 ||
        sourceFilter.some((filterValue) => isSourceMatch(row.source, filterValue));
      return modeMatch && keyMatch && stateMatch && sourceMatch;
    });
  }, [modeFilter, keyFilter, stateFilter, sourceFilter, rows]);

  const fuse = useMemo(() => {
    return new Fuse(filteredRows, {
      keys: ["song", "artist"],
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
  }, [query, modeFilter, keyFilter, stateFilter, sourceFilter, sortOption, sortDirection]);

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto rounded-lg border border-neutral-200 bg-white p-6 text-center text-neutral-600">
        Loading sheet data…
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-4xl mx-auto rounded-lg border border-red-200 bg-red-50 text-red-700 p-6 text-sm">
        Couldn&apos;t load the sheet: {error}
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
              <p className="mb-2 text-sm font-semibold text-neutral-700">Mode</p>
              <div className="grid gap-2">
                {modeOptions.map((option) => (
                  <label key={option} className="inline-flex items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={modeFilter.includes(option)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...modeFilter, option]
                          : modeFilter.filter((value) => value !== option);
                        setModeFilter(next);
                      }}
                      className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-neutral-700">Key</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {keyOptions.map((keyOption) => (
                  <label key={keyOption} className="inline-flex items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={keyFilter.includes(keyOption)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...keyFilter, keyOption]
                          : keyFilter.filter((value) => value !== keyOption);
                        setKeyFilter(next);
                      }}
                      className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                    />
                    {keyOption}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-neutral-700">State</p>
              <div className="grid gap-2">
                {stateOptions.map((option) => (
                  <label key={option} className="inline-flex items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={stateFilter.includes(option)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...stateFilter, option]
                          : stateFilter.filter((value) => value !== option);
                        setStateFilter(next);
                      }}
                      className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-neutral-700">Source</p>
              <div className="grid gap-2">
                {sourceOptions.map((source) => (
                  <label key={source} className="inline-flex items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={sourceFilter.includes(source)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...sourceFilter, source]
                          : sourceFilter.filter((value) => value !== source);
                        setSourceFilter(next);
                      }}
                      className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                    />
                    {source}
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
                {results.length} of {filteredRows.length} row{filteredRows.length === 1 ? "" : "s"}
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
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                      {columns.map((col) => {
                        const value = row[col.key];
                        if (col.key === "extra_info" && !value) return null;
                        return (
                          <div key={col.key} className="flex gap-2 text-sm">
                            <dt className="font-medium text-neutral-500 shrink-0">
                              {col.label}:
                            </dt>
                            <dd className="text-neutral-900 break-words">
                              {value || "—"}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
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
