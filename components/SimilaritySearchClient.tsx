"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Fuse from "fuse.js";
import type { TrackRow } from "@/lib/fetchTracks";

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
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
};

export default function SimilaritySearchClient() {
  const [rows, setRows] = useState<TrackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedSongKey, setSelectedSongKey] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [draftWeights, setDraftWeights] = useState<WeightState>({ bpm: 0.5, key: 0.5 });
  const [activeWeights, setActiveWeights] = useState<WeightState>({ bpm: 0.5, key: 0.5 });
  const [ranking, setRanking] = useState<RankedSong[]>([]);
  const [hasCalculated, setHasCalculated] = useState(false);

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
    setActiveWeights(draftWeights);
    setHasCalculated(true);
  }, [draftWeights, rows, selectedRow]);

  const handleRecalculate = () => {
    if (!selectedRow) {
      setRanking([]);
      setHasCalculated(false);
      return;
    }

    const nextRanking = computeRanking(selectedRow, rows, draftWeights);
    setRanking(nextRanking);
    setActiveWeights(draftWeights);
    setHasCalculated(true);
  };

  const handleBpmWeightChange = (value: number) => {
    const clampedValue = clampWeight(value);
    setDraftWeights({ bpm: clampedValue, key: clampWeight(1 - clampedValue) });
  };

  const handleKeyWeightChange = (value: number) => {
    const clampedValue = clampWeight(value);
    setDraftWeights({ bpm: clampWeight(1 - clampedValue), key: clampedValue });
  };

  return (
    <div className="mx-auto w-full max-w-6xl rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Similarity search</h2>
          <p className="text-sm text-neutral-600">Pick a song, then rank others by BPM and key similarity.</p>
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
                  <p className="text-sm text-neutral-600">Adjust the slider, then press the button below to recalculate the ranking.</p>
                </div>
              </div>

              <div className="mt-4 space-y-4">
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
                    onChange={(event) => handleBpmWeightChange(Number(event.target.value))}
                    className="w-full accent-neutral-900"
                  />
                </label>

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
                    onChange={(event) => handleKeyWeightChange(Number(event.target.value))}
                    className="w-full accent-neutral-900"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-600">
                <span>Current active mix:</span>
                <span className="font-medium text-neutral-900">BPM {activeWeights.bpm.toFixed(2)} • Key {activeWeights.key.toFixed(2)}</span>
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
                    {selectedRow.bpm != null ? <span className="rounded-full bg-neutral-100 px-2 py-1">BPM: {selectedRow.bpm}</span> : null}
                    {(selectedRow.key || selectedRow.mode) ? (
                      <span className="rounded-full bg-neutral-100 px-2 py-1">
                        Key: {selectedRow.key && selectedRow.mode ? `${selectedRow.key} ${selectedRow.mode}` : selectedRow.key || selectedRow.mode}
                      </span>
                    ) : null}
                    {selectedRow.album ? <span className="rounded-full bg-neutral-100 px-2 py-1">Album: {selectedRow.album}</span> : null}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-neutral-600">Choose a track from the autocomplete to start ranking similar songs.</p>
              )}
            </div>

            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-neutral-900">Similar tracks</h3>
              </div>

              {!hasCalculated ? (
                <p className="text-sm text-neutral-600">Once you recalculate, the highest-scoring tracks will appear here.</p>
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
                        <span className="rounded-full bg-neutral-50 px-2 py-1">BPM sim: {(item.bpmSimilarity * 100).toFixed(0)}%</span>
                        <span className="rounded-full bg-neutral-50 px-2 py-1">Key sim: {(item.keySimilarity * 100).toFixed(0)}%</span>
                        {item.row.bpm != null ? <span className="rounded-full bg-neutral-50 px-2 py-1">BPM: {item.row.bpm}</span> : null}
                        {(item.row.key || item.row.mode) ? (
                          <span className="rounded-full bg-neutral-50 px-2 py-1">
                            Key: {item.row.key && item.row.mode ? `${item.row.key} ${item.row.mode}` : item.row.key || item.row.mode}
                          </span>
                        ) : null}
                        {item.row.album ? <span className="rounded-full bg-neutral-50 px-2 py-1">Album: {item.row.album}</span> : null}
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
