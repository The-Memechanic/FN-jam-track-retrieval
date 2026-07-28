"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Fuse from "fuse.js";
import type { TrackRow } from "@/lib/fetchTracks";
import { useSearchParams } from "next/navigation";
import { matchesTrackSlug, getTrackSlug } from "@/lib/trackSlug";

type WeightState = {
  bpm: number;
  key: number;
};

type RankedSong = {
  row: TrackRow;
  score: number;
  bpmSimilarity: number;
  keySimilarity: number;
};

const PAGE_SIZE = 10; // 5 columns x 2 rows

const toDisplayLabel = (row: TrackRow) => {
  if (row.artist && row.song) {
    return `${row.song} — ${row.artist}`;
  }
  return row.song || row.artist || "Untitled track";
};

const toRowKey = (row: TrackRow) => {
  return `${row.song || ""}::${row.artist || ""}::${row.id || ""}::${row.album || ""}`;
};

const parseBpm = (value?: number | null) => (typeof value === "number" ? value : null);

const getPitchClass = (value?: string | null) => {
  const raw = value?.trim() ?? "";
  if (!raw) {
    return null;
  }

  const normalized = raw
    .replace(/[♯#]/g, "#")
    .replace(/[♭b]/g, "b")
    .replace(/\s+/g, "")
    .toUpperCase();

  const tokens = normalized.split("/").filter(Boolean);

  const pitchMap: Record<string, number> = {
    C: 0,
    "C#": 1,
    CB: 11,
    D: 2,
    "D#": 3,
    DB: 1,
    E: 4,
    EB: 3,
    F: 5,
    "F#": 6,
    GB: 6,
    G: 7,
    "G#": 8,
    AB: 8,
    A: 9,
    "A#": 10,
    BB: 10,
    B: 11,
  };

  for (const token of tokens) {
    const pitch = pitchMap[token];
    if (pitch !== undefined) {
      return pitch;
    }
  }

  return null;
};

const getBpmSimilarity = (left?: number | null, right?: number | null) => {
  const leftBpm = parseBpm(left);
  const rightBpm = parseBpm(right);

  if (leftBpm === null || rightBpm === null) {
    return 0;
  }

  const difference = Math.abs(leftBpm - rightBpm);
  const normalized = Math.max(0, 1 - difference / 60);
  return Math.min(1, normalized);
};

const getKeySimilarity = (
  leftKey?: string | null,
  rightKey?: string | null,
  leftMode?: string | null,
  rightMode?: string | null
) => {
  const leftPitch = getPitchClass(leftKey);
  const rightPitch = getPitchClass(rightKey);

  if (leftPitch === null || rightPitch === null) {
    return 0;
  }

  const difference = Math.abs(leftPitch - rightPitch);
  const shortestDistance = Math.min(difference, 12 - difference);
  const baseSimilarity = Math.max(0, 1 - shortestDistance / 6);

  const leftModeNormalized = (leftMode ?? "").trim().toLowerCase();
  const rightModeNormalized = (rightMode ?? "").trim().toLowerCase();

  if (leftModeNormalized && rightModeNormalized && leftModeNormalized !== rightModeNormalized) {
    return baseSimilarity * 0.5;
  }

  return baseSimilarity;
};

const clampWeight = (value: number) => Math.max(0, Math.min(1, Number(value.toFixed(2))));

const computeRanking = (
  targetRow: TrackRow,
  allRows: TrackRow[],
  weights: WeightState
): RankedSong[] => {
  const targetKey = toRowKey(targetRow);

  return allRows
    .filter((row) => toRowKey(row) !== targetKey)
    .map((row) => {
      const bpmSimilarity = getBpmSimilarity(targetRow.bpm, row.bpm);
      const keySimilarity = getKeySimilarity(targetRow.key, row.key, targetRow.mode, row.mode);
      const score = bpmSimilarity * weights.bpm + keySimilarity * weights.key;

      return {
        row,
        score,
        bpmSimilarity,
        keySimilarity,
      };
    })
    .sort((a, b) => b.score - a.score);
};

// Score → ring color, from legendary (gold) to epic (purple) to rare (blue) to common (gray)
const getScoreRingClass = (score: number) => {
  if (score >= 0.9) return "ring-amber-400 dark:ring-amber-600";
  if (score >= 0.75) return "ring-purple-400 dark:ring-purple-600";
  if (score >= 0.5) return "ring-sky-400 dark:ring-sky-600";
  return "ring-neutral-300 dark:ring-neutral-600";
}

const getScoreTextClass = (score: number) => {
  if (score >= 0.9) return "text-amber-600 dark:text-amber-400";
  if (score >= 0.75) return "text-purple-600 dark:text-purple-400";
  if (score >= 0.5) return "text-sky-600 dark:text-sky-400";
  return "text-neutral-700 dark:text-neutral-300";
}

export default function SimilaritySearchClient() {
  const [rows, setRows] = useState<TrackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedSongKey, setSelectedSongKey] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [draftWeights, setDraftWeights] = useState<WeightState>({ bpm: 0.5, key: 0.5 });
  const [ranking, setRanking] = useState<RankedSong[]>([]);
  const [hasCalculated, setHasCalculated] = useState(false);
  const [page, setPage] = useState(1);
  const searchParams = useSearchParams();

  useEffect(() => {
    async function loadRows() {
      setLoading(true);
      try {
        const response = await fetch("/api/data");
        if (!response.ok) {
          throw new Error(`Failed to load track data: ${response.status}`);
        }
        const data = await response.json();
        setRows(data.rows ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    loadRows();
  }, []);

  const suggestions = useMemo(() => {
    if (!query.trim() || !showSuggestions) {
      return [];
    }

    const fuse = new Fuse(rows, {
      keys: ["song", "artist", "album"],
      threshold: 0.35,
      ignoreLocation: true,
      distance: 100,
    });

    return fuse.search(query, { limit: 8 }).map((result) => result.item);
  }, [query, rows]);

  const selectedRow = useMemo(() => {
    if (!selectedSongKey) {
      return null;
    }

    return rows.find((row) => toRowKey(row) === selectedSongKey) ?? null;
  }, [rows, selectedSongKey]);

  useEffect(() => {
    if (!selectedRow) {
      setRanking([]);
      setHasCalculated(false);
      return;
    }

    const nextRanking = computeRanking(selectedRow, rows, draftWeights);
    setRanking(nextRanking);
    setHasCalculated(true);
  }, [draftWeights, rows, selectedRow]);

  useEffect(() => {
    setPage(1);
  }, [selectedRow, draftWeights]);

  useEffect(() => {
  if (loading || rows.length === 0) return;

  const trackSlug = searchParams.get("track");
  if (!trackSlug) return;

  const match = rows.find((row) => matchesTrackSlug(row, trackSlug));
  if (match) {
    setSelectedSongKey(toRowKey(match));
    setQuery(toDisplayLabel(match));
  }
}, [loading, rows, searchParams]);

  const handleBpmWeightChange = (value: number) => {
    const clampedValue = clampWeight(value);
    setDraftWeights({ bpm: clampedValue, key: clampWeight(1 - clampedValue) });
  };

  const handleKeyWeightChange = (value: number) => {
    const clampedValue = clampWeight(value);
    setDraftWeights({ bpm: clampWeight(1 - clampedValue), key: clampedValue });
  };

  const totalPages = Math.max(1, Math.ceil(ranking.length / PAGE_SIZE));
  const paginatedRanking = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return ranking.slice(start, start + PAGE_SIZE);
  }, [page, ranking]);

  const goToPage = (next: number) => {
    const clamped = Math.max(1, Math.min(totalPages, next));
    setPage(clamped);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl">
      {loading ? (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-6 text-center text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
          Loading tracks…
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          Couldn&apos;t load tracks: {error}
        </div>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5">
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800">
                <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300" htmlFor="song-search">
                  Search for a song
                </label>
                <div className="relative">
                  <input
                    id="song-search"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setSelectedSongKey(null);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => {
                      window.setTimeout(() => setShowSuggestions(false), 120);
                    }}
                    placeholder="Type a song name…"
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none ring-0 focus:border-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                  />
                  {suggestions.length > 0 ? (
                    <ul className="absolute z-10 mt-2 max-h-64 w-full overflow-auto rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                      {suggestions.map((song) => {
                        const label = toDisplayLabel(song);
                        return (
                          <li key={toRowKey(song)}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSongKey(toRowKey(song));
                                setQuery(label);
                                setShowSuggestions(false);
                              }}
                              className="flex w-full flex-col items-start px-3 py-2 text-left text-sm text-neutral-700 transition hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-800"
                            >
                              <span className="font-medium text-neutral-900 dark:text-neutral-100">{song.song}</span>
                              <span className="text-xs text-neutral-500 dark:text-neutral-400">{song.artist || "Unknown artist"}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              </div>

              <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Similarity weights</h3>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">Adjust the slider to recalculate the ranking.</p>
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    <div className="mb-2 flex items-center justify-between">
                      <span>BPM weight</span>
                      <span className="text-neutral-500 dark:text-neutral-300">{draftWeights.bpm.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={draftWeights.bpm}
                      onChange={(event) => handleBpmWeightChange(Number(event.target.value))}
                      className="w-full accent-neutral-900 dark:accent-neutral-400"
                    />
                  </label>

                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    <div className="mb-2 flex items-center justify-between">
                      <span>Key weight</span>
                      <span className="text-neutral-500 dark:text-neutral-300">{draftWeights.key.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={draftWeights.key}
                      onChange={(event) => handleKeyWeightChange(Number(event.target.value))}
                      className="w-full accent-neutral-900 dark:accent-neutral-400"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800">
              <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Selected track</h3>
              {selectedRow ? (
                <Link
                  href={`/track/${getTrackSlug(selectedRow)}`}
                  className="group mt-3 block overflow-hidden rounded-xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-50 p-4 shadow-sm transition hover:border-neutral-400 dark:border-neutral-600 dark:from-neutral-800 dark:to-neutral-900 dark:hover:border-neutral-400"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <div className="h-48 w-48 overflow-hidden rounded-lg shadow-sm ring-1 ring-black/5 dark:ring-white/10">
                        {selectedRow.albumArt ? (
                          <img
                            src={selectedRow.albumArt}
                            alt={selectedRow.song || "Album art"}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-neutral-900 text-lg font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900">
                            ★
                          </div>
                        )}
                      </div>
                      <div className="mt-2 flex justify-center gap-6">
                        {selectedRow.bpm != null ? (
                          <span className="rounded-full bg-neutral-900/5 px-2.5 py-1 text-xs font-medium dark:bg-white/10">
                            BPM {selectedRow.bpm}
                          </span>
                        ) : null}
                        {selectedRow.key || selectedRow.mode ? (
                          <span className="rounded-full bg-neutral-900/5 px-2.5 py-1 text-xs font-medium dark:bg-white/10">
                            {selectedRow.key && selectedRow.mode ? `${selectedRow.key} ${selectedRow.mode}` : selectedRow.key || selectedRow.mode}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="min-w-0 pt-1">
                      <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{selectedRow.song}</p>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">{selectedRow.artist || "Unknown artist"}</p>
                    </div>
                  </div>
                </Link>
              ) : (
                <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">Choose a track from the autocomplete to start ranking similar songs.</p>
              )}
            </div>
          </div>

          {/* Results: full-width, 5x2 grid, paginated across all matches */}
          <section className="mt-8">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Similar tracks</h2>
              {hasCalculated && ranking.length > 0 ? (
                <span className="text-sm text-neutral-500 dark:text-neutral-400">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, ranking.length)} of {ranking.length}
                </span>
              ) : null}
            </div>

            {!hasCalculated ? (
              <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
                Pick a track above to see its closest matches by BPM and key.
              </div>
            ) : ranking.length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
                No similar tracks were found.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {paginatedRanking.map((item, index) => {
                    const rank = (page - 1) * PAGE_SIZE + index + 1;
                    return (
                      <div
                        key={toRowKey(item.row)}
                        className={`group relative flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm ring-1 ring-inset transition hover:-translate-y-0.5 hover:shadow-md dark:border-neutral-700 dark:bg-neutral-800 ${getScoreRingClass(
                          item.score
                        )}`}
                      >
                        <div className="flex items-start justify-between">
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
                            #{rank}
                          </span>
                          <span className={`text-lg font-bold leading-none ${getScoreTextClass(item.score)}`}>
                            {(item.score * 100).toFixed(0)}
                            <span className="text-xs font-medium">%</span>
                          </span>
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">{item.row.song || "Untitled track"}</p>
                          <p className="truncate text-xs text-neutral-600 dark:text-neutral-400">{item.row.artist || "Unknown artist"}</p>
                        </div>

                        <div className="mt-auto flex flex-wrap gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-300">
                          {item.row.bpm != null ? (
                            <span className="rounded-full bg-neutral-100 px-2 py-0.5 dark:bg-neutral-900">
                              {item.row.bpm} BPM
                            </span>
                          ) : null}
                          {item.row.key || item.row.mode ? (
                            <span className="rounded-full bg-neutral-100 px-2 py-0.5 dark:bg-neutral-900">
                              {item.row.key && item.row.mode ? `${item.row.key} ${item.row.mode}` : item.row.key || item.row.mode}
                            </span>
                          ) : null}
                        </div>

                        <div className="flex gap-1.5 text-[10px] text-neutral-500 dark:text-neutral-300">
                          <span>BPM sim {Math.round(item.bpmSimilarity * 100)}%</span>
                          <span>·</span>
                          <span>Key sim {Math.round(item.keySimilarity * 100)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {totalPages > 1 ? (
                  <div className="mt-6 flex flex-col items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-700 shadow-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 sm:flex-row">
                    <p>
                      Page {page} of {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => goToPage(page - 1)}
                        disabled={page === 1}
                        className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                      >
                        Go Back
                      </button>
                      <button
                        type="button"
                        onClick={() => goToPage(page + 1)}
                        disabled={page === totalPages}
                        className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                      >
                        Keep Going
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}