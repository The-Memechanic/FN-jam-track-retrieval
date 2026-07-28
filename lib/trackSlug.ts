import type { TrackRow } from "@/lib/fetchTracks";

export function getTrackSlug(row: TrackRow): string {
  const key = row.id
    ? String(row.id)
    : `${row.song ?? ""}::${row.artist ?? ""}::${row.album ?? ""}`;
  return encodeURIComponent(key);
}

export function matchesTrackSlug(row: TrackRow, slug: string): boolean {
  return getTrackSlug(row) === slug;
}