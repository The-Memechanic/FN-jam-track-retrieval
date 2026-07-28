"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useRef } from "react";
import { useParams } from "next/navigation";
import type { TrackRow } from "@/lib/fetchTracks";
import { getTrackSlug, matchesTrackSlug } from "@/lib/trackSlug";

const HIDDEN_KEYS = new Set([
  "song",
  "artist",
  "albumArt",
  "id",
  "key",
  "mode",
  "difficulty",
  "previewUrl",
]);

const DIFFICULTY_ORDER = [
  "vocals",
  "guitar",
  "bass",
  "drums",
  "plasticVocals",
  "plasticGuitar",
  "plasticBass",
  "plasticDrums",
] as const;

const DIFFICULTY_MAX = 7;
const DIFFICULTY_DISPLAY_OFFSET = 1; // raw API 0–6 -> displayed 1–7

const LABEL_OVERRIDES: Record<string, string> = {
  plasticVocals: "Pro Vocals",
  plasticGuitar: "Pro Guitar",
  plasticBass: "Pro Bass",
  plasticDrums: "Pro Drums",
};

const formatLabel = (key: string) => {
  if (LABEL_OVERRIDES[key]) {
    return LABEL_OVERRIDES[key];
  }

  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
};

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ") || "—";
  return String(value);
};

const isEmpty = (value: unknown): boolean => {
  if (value === null || value === undefined || value === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
};

const formatDuration = (seconds: unknown): string => {
  const total = Math.round(Number(seconds));
  if (!Number.isFinite(total) || total < 0) return "—";
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
};

const formatAddedDate = (value: unknown): string => {
  if (typeof value !== "string") return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const difficultyColor = (displayValue: number): string => {
  if (displayValue <= 1) return "bg-emerald-500";
  if (displayValue <= 2) return "bg-lime-500";
  if (displayValue <= 3) return "bg-yellow-500";
  if (displayValue <= 4) return "bg-amber-500";
  if (displayValue <= 5) return "bg-orange-500";
  if (displayValue <= 6) return "bg-red-500";
  return "bg-red-700";
};

function DifficultyDots({ value }: { value: number }) {
  const displayValue = value + DIFFICULTY_DISPLAY_OFFSET;
  const filled = Math.max(0, Math.min(DIFFICULTY_MAX, displayValue));
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: DIFFICULTY_MAX }).map((_, i) => (
        <span
          key={i}
          className={`h-3.5 w-3.5 rounded-full ${
            i < filled ? difficultyColor(filled) : "bg-neutral-200 dark:bg-neutral-700"
          }`}
        />
      ))}
    </div>
  );
}

function DifficultyBadges({ difficulty }: { difficulty: Record<string, unknown> }) {
  const entries = DIFFICULTY_ORDER.filter(
    (key) => !isEmpty(difficulty[key]) && Number.isFinite(Number(difficulty[key]))
  );

  if (entries.length === 0) return null;

  return (
    <div className="grid grid-cols-4 gap-x-20 gap-y-8 sm:grid-cols-2">
      {entries.map((key) => {
        const rawValue = Number(difficulty[key]);
        const displayValue = rawValue + DIFFICULTY_DISPLAY_OFFSET;
        return (
          <div key={key} className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              {formatLabel(key)}{" "}
              <span className="text-neutral-400 dark:text-neutral-500">({displayValue})</span>
            </span>
            <DifficultyDots value={rawValue} />
          </div>
        );
      })}
    </div>
  );
}

function PreviewButton({ previewUrl }: { previewUrl: string | null }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!previewUrl) return;
    const audio = new Audio(previewUrl);
    audio.onended = () => setPlaying(false);
    audioRef.current = audio;
    return () => {
      audio.pause();
    };
  }, [previewUrl]);

  if (!previewUrl) {
    return (
      <span className="self-start rounded-lg bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400">
        No preview available
      </span>
    );
  }

  const handleClick = () => {
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
    } else {
      audioRef.current?.play();
      setPlaying(true);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-2 self-start rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-neutral-200"
    >
      {playing ? "Pause preview" : "▶ Play preview"}
    </button>
  );
}

export default function TrackPage() {
  const params = useParams<{ slug: string | string[] }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;

  const [rows, setRows] = useState<TrackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRows() {
      setLoading(true);
      try {
        const res = await fetch("/api/data");
        if (!res.ok) throw new Error(`Failed to load track data: ${res.status}`);
        const data = await res.json();
        setRows(data.rows ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    loadRows();
  }, []);

  const track = useMemo(() => {
    if (!slug) return null;
    return rows.find((row) => matchesTrackSlug(row, slug)) ?? null;
  }, [rows, slug]);

  const details = useMemo(() => {
    if (!track) return [];

    const entries: [string, unknown][] = [];

    const combinedKey = [track.key, track.mode].filter(Boolean).join(" ");
    if (combinedKey) {
      entries.push(["key", combinedKey]);
    }

    Object.entries(track).forEach(([key, value]) => {
      if (HIDDEN_KEYS.has(key)) return;
      if (isEmpty(value)) return;
      entries.push([key, value]);
    });

    return entries;
  }, [track]);

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8 text-neutral-900 transition-colors dark:bg-neutral-900 dark:text-neutral-100">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-neutral-200"
          >
            ← Back to search
          </Link>

          {track ? (
            <Link
              href={`/similarity?track=${getTrackSlug(track)}`}
              className="inline-flex items-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-neutral-200"
            >
              Find similar tracks →
            </Link>
          ) : null}
        </div>

        {loading ? (
          <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center text-neutral-600 shadow-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            Loading track…
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            Couldn&apos;t load the track: {error}
          </div>
        ) : !track ? (
          <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center text-neutral-600 shadow-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            We couldn&apos;t find that track.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
            <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-stretch">
              {track.albumArt ? (
                <img
                  src={track.albumArt}
                  alt={track.song || "Album art"}
                  className="h-64 w-64 flex-shrink-0 rounded-lg object-cover shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                />
              ) : (
                <div className="flex h-64 w-64 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-2xl font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900">
                  ★
                </div>
              )}
              <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-stretch sm:justify-between">
                <div className="flex h-64 flex-1 flex-col justify-between gap-3">
                  <div>
                    <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
                      {track.song || "Untitled track"}
                    </h1>
                    <p className="text-neutral-600 dark:text-neutral-400">
                      {track.artist || "Unknown artist"}
                    </p>
                  </div>

                  <PreviewButton previewUrl={track.previewUrl} />
                </div>

                <div className="flex h-64 items-center sm:border-l sm:border-neutral-200 sm:pl-6 sm:dark:border-neutral-700">
                  <DifficultyBadges
                    difficulty={track.difficulty as unknown as Record<string, unknown>}
                  />
                </div>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 border-t border-neutral-200 p-6 sm:grid-cols-2 dark:border-neutral-700">
              {details.map(([key, value]) => {
                let displayValue: string;
                if (key === "duration") {
                  displayValue = formatDuration(value);
                } else if (key === "added") {
                  displayValue = formatAddedDate(value);
                } else {
                  displayValue = formatValue(value);
                }

                return (
                  <div key={key}>
                    <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      {formatLabel(key)}
                    </dt>
                    <dd className="mt-1 text-sm text-neutral-900 dark:text-neutral-100">
                      {displayValue}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        )}
      </div>
    </main>
  );
}