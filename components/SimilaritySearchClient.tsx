"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Fuse from "fuse.js";
import type { SheetRow } from "@/lib/fetchSheet";

type WeightState = {
  key: number;
  bpm: number;
};

type RankedSong = {
  row: SheetRow;
  score: number;
  keySimilarity: number;
  bpmSimilarity: number;
};

const normalizeText = (value?: string) => value?.trim().toLowerCase() ?? "";

const toDisplayLabel = (row: SheetRow) => {
  if (row.artist && row.song) {
    return `${row.song} — ${row.artist}`;
  }
  return row.song || row.artist || "Untitled track";
};

const toRowKey = (row: SheetRow) => {
  return `${row.song || ""}::${row.artist || ""}::${row.id || ""}::${row.source || ""}`;
};

const parseBpm = (value?: string) => {
  const numeric = Number((value ?? "").replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
};

// Parses just the root note(s), e.g. "C", "F#", "Bb", "Db/C#"
const parseKeyRoots = (value?: string) => {
  const normalized = normalizeText(value)
    .replace(/\s+/g, "")
    .replace(/[♯#]/g, "#")
    .replace(/[♭b]/g, "b");

  if (!normalized || normalized === "num") {
    return null;
  }

  const rootMap: Record<string, number> = {
    c: 0,
    "c#": 1,
    db: 1,
    d: 2,
    "d#": 3,
    eb: 3,
    e: 4,
    f: 5,
    "f#": 6,
    gb: 6,
    g: 7,
    "g#": 8,
    ab: 8,
    a: 9,
    "a#": 10,
    bb: 10,
    b: 11,
  };

  const roots = normalized
    .split("/")
    .map((entry) => rootMap[entry])
    .filter((root): root is number => root !== undefined);

  return roots.length > 0 ? roots : null;
};

// Parses the separate "mode" column, e.g. "Major" / "Minor"
const parseMode = (value?: string): "major" | "minor" | null => {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (/^(min|minor|m|mi)$/.test(normalized)) return "minor";
  if (/^(maj|major)$/.test(normalized)) return "major";
  return null;
};

const getKeySimilarity = (
  leftKey?: string,
  leftMode?: string,
  rightKey?: string,
  rightMode?: string
) => {
  const leftRoots = parseKeyRoots(leftKey);
  const rightRoots = parseKeyRoots(rightKey);

  if (!leftRoots || !rightRoots) {
    return 0;
  }

  const leftM = parseMode(leftMode);
  const rightM = parseMode(rightMode);

  let bestScore = 0;

  leftRoots.forEach((leftRoot) => {
    rightRoots.forEach((rightRoot) => {
      const distance = Math.abs(leftRoot - rightRoot);
      const wrappedDistance = Math.min(distance, 12 - distance);
      const rootScore = Math.max(0, 1 - wrappedDistance / 6);

      let score = rootScore;
      if (leftM && rightM && leftM !== rightM) {
        score = Math.max(0, rootScore - 0.5); // opposite-mode penalty
      }

      bestScore = Math.max(bestScore, score);
    });
  });

  return bestScore;
};

const getBpmSimilarity = (left?: string, right?: string) => {
  const leftBpm = parseBpm(left);
  const rightBpm = parseBpm(right);

  if (leftBpm === null || rightBpm === null) {
    return 0;
  }

  const difference = Math.abs(leftBpm - rightBpm);
  const normalized = Math.max(0, 1 - difference / 60);
  return Math.min(1, normalized);
};

const clampWeight = (value: number) => Math.max(0, Math.min(1, Number(value.toFixed(2))));

const computeRanking = (
  targetRow: SheetRow,
  allRows: SheetRow[],
  weights: WeightState
): RankedSong[] => {
  const targetKey = toRowKey(targetRow);

  return allRows
    .filter((row) => toRowKey(row) !== targetKey)
    .map((row) => {
      const keySimilarity = getKeySimilarity(targetRow.key, targetRow.mode, row.key, row.mode);
      const bpmSimilarity = getBpmSimilarity(targetRow.bpm, row.bpm);
      const score = keySimilarity * weights.key + bpmSimilarity * weights.bpm;

      return {
        row,
        score,
        keySimilarity,
        bpmSimilarity,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
};

export default function SimilaritySearchClient() {
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedSongKey, setSelectedSongKey] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [draftWeights, setDraftWeights] = useState<WeightState>({ key: 0.5, bpm: 0.5 });
  const [activeWeights, setActiveWeights] = useState<WeightState>({ key: 0.5, bpm: 0.5 });
  const [ranking, setRanking] = useState<RankedSong[]>([]);
  const [hasCalculated, setHasCalculated] = useState(false);

  useEffect(() => {
    async function loadRows() {
      setLoading(true);
      try {
        const response = await fetch("/api/data");
        if (!response.ok) {
          throw new Error(`Failed to load sheet data: ${response.status}`);
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
      keys: ["song", "artist"],
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

  const handleRecalculate = () => {
    if (!selectedRow) {
      setRanking([]);
      setHasCalculated(false);
      return;
    }

    setRanking(computeRanking(selectedRow, rows, draftWeights));
    setActiveWeights(draftWeights);
    setHasCalculated(true);
  };

  const handleWeightChange = (type: "key" | "bpm", value: number) => {
    const nextValue = clampWeight(value);
    if (type === "key") {
      setDraftWeights({ key: nextValue, bpm: clampWeight(1 - nextValue) });
      return;
    }

    setDraftWeights({ key: clampWeight(1 - nextValue), bpm: nextValue });
  };

  return (
    <div className="mx-auto w-full max-w-6xl rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Similarity search</h2>
          <p className="text-sm text-neutral-600">
            Pick a song, then rank others by key and BPM similarity.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
        >
          Back to main search
        </Link>
      </div>

      {loading ? (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-6 text-center text-neutral-600">
          Loading tracks…
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Couldn&apos;t load tracks: {error}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <label className="mb-2 block text-sm font-medium text-neutral-700" htmlFor="song-search">
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
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none ring-0 focus:border-neutral-900"
                />
                {suggestions.length > 0 ? (
                  <ul className="absolute z-10 mt-2 max-h-64 w-full overflow-auto rounded-lg border border-neutral-200 bg-white shadow-lg">
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
                              setActiveWeights(draftWeights);
                              setHasCalculated(true);
                              setRanking(computeRanking(song, rows, draftWeights));
                            }}
                            className="flex w-full flex-col items-start px-3 py-2 text-left text-sm text-neutral-700 transition hover:bg-neutral-50"
                          >
                            <span className="font-medium text-neutral-900">{song.song}</span>
                            <span className="text-xs text-neutral-500">{song.artist || "Unknown artist"}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-neutral-500">
                Suggestions include the artist name when it helps distinguish tracks with the same title.
              </p>
            </div>

            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-neutral-900">Similarity weights</h3>
                  <p className="text-sm text-neutral-600">
                    Adjust the sliders, then press the button below to recalculate the ranking.
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                <label className="block text-sm font-medium text-neutral-700">
                  <div className="mb-2 flex items-center justify-between">
                    <span>Key weight</span>
                    <span className="text-neutral-500">{draftWeights.key.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={draftWeights.key}
                    onChange={(event) => handleWeightChange("key", Number(event.target.value))}
                    className="w-full accent-neutral-900"
                  />
                </label>

                <label className="block text-sm font-medium text-neutral-700">
                  <div className="mb-2 flex items-center justify-between">
                    <span>BPM weight</span>
                    <span className="text-neutral-500">{draftWeights.bpm.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={draftWeights.bpm}
                    onChange={(event) => handleWeightChange("bpm", Number(event.target.value))}
                    className="w-full accent-neutral-900"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-600">
                <span>Current active mix:</span>
                <span className="font-medium text-neutral-900">Key {activeWeights.key.toFixed(2)}</span>
                <span className="font-medium text-neutral-900">BPM {activeWeights.bpm.toFixed(2)}</span>
              </div>

              <button
                type="button"
                onClick={handleRecalculate}
                className="mt-4 inline-flex items-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
              >
                Recalculate ranking
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <h3 className="text-base font-semibold text-neutral-900">Selected track</h3>
              {selectedRow ? (
                <div className="mt-3 rounded-lg border border-neutral-200 bg-white p-3">
                  <p className="font-medium text-neutral-900">{selectedRow.song}</p>
                  <p className="text-sm text-neutral-600">{selectedRow.artist || "Unknown artist"}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-500">
                    <span className="rounded-full bg-neutral-100 px-2 py-1">
                      Key: {selectedRow.key || "—"} {selectedRow.mode || ""}
                    </span>
                    <span className="rounded-full bg-neutral-100 px-2 py-1">BPM: {selectedRow.bpm || "—"}</span>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-neutral-600">
                  Choose a track from the autocomplete to start ranking similar songs.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-neutral-900">Similar tracks</h3>
              </div>

              {!hasCalculated ? (
                <p className="text-sm text-neutral-600">
                  Once you recalculate, the highest-scoring tracks will appear here.
                </p>
              ) : ranking.length === 0 ? (
                <p className="text-sm text-neutral-600">No similar tracks were found.</p>
              ) : (
                <ol className="space-y-3">
                  {ranking.map((item, index) => (
                    <li key={toRowKey(item.row)} className="rounded-lg border border-neutral-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-neutral-900">{index + 1}. {item.row.song}</p>
                          <p className="text-sm text-neutral-600">{item.row.artist || "Unknown artist"}</p>
                        </div>
                        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-sm font-semibold text-neutral-700">
                          {(item.score * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-500">
                        <span className="rounded-full bg-neutral-50 px-2 py-1">Key sim: {(item.keySimilarity * 100).toFixed(0)}%</span>
                        <span className="rounded-full bg-neutral-50 px-2 py-1">BPM sim: {(item.bpmSimilarity * 100).toFixed(0)}%</span>
                        <span className="rounded-full bg-neutral-50 px-2 py-1">
                          Key: {item.row.key || "—"} {item.row.mode || ""}
                        </span>
                        <span className="rounded-full bg-neutral-50 px-2 py-1">BPM: {item.row.bpm || "—"}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}