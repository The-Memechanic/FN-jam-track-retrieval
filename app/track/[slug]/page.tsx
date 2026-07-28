"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type { TrackRow } from "@/lib/fetchTracks";
import { getTrackSlug, matchesTrackSlug } from "@/lib/trackSlug";

const HIDDEN_KEYS = new Set(["song", "artist", "albumArt", "id"]);

const formatLabel = (key: string) =>
  key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ") || "—";
  return String(value);
};

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
    return Object.entries(track).filter(([key]) => !HIDDEN_KEYS.has(key));
  }, [track]);

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8 text-neutral-900 transition-colors dark:bg-neutral-900 dark:text-neutral-100">
      <div className="mx-auto w-full max-w-3xl">
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
            <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start">
              {track.albumArt ? (
                <img
                  src={track.albumArt}
                  alt={track.song || "Album art"}
                  className="h-48 w-48 flex-shrink-0 rounded-lg object-cover shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                />
              ) : (
                <div className="flex h-48 w-48 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-2xl font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900">
                  ★
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
                  {track.song || "Untitled track"}
                </h1>
                <p className="text-neutral-600 dark:text-neutral-400">
                  {track.artist || "Unknown artist"}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 border-t border-neutral-200 p-6 sm:grid-cols-2 dark:border-neutral-700">
              {details.map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    {formatLabel(key)}
                  </dt>
                  <dd className="mt-1 text-sm text-neutral-900 dark:text-neutral-100">
                    {formatValue(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </main>
  );
}