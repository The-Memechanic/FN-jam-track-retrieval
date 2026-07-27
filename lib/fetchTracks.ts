import { fetchSheetTrackMetadata } from "@/lib/fetchSheet";

export type TrackRow = {
  id: string;
  devName: string;
  song: string;
  artist: string;
  album: string;
  releaseYear: number | null;
  bpm: number | null;
  duration: number | null;
  difficulty: string;
  genres: string[];
  gameplayTags: string[];
  albumArt: string;
  added: string;
  shopHistory: string[];
  key: string;
  mode: string;
};

type FortniteTrackDifficulty = {
  vocals: number;
  guitar: number;
  bass: number;
  plasticBass: number;
  drums: number;
  plasticDrums: number;
};

type FortniteTrack = {
  id: string;
  devName: string;
  title: string;
  artist: string;
  album: string;
  releaseYear: number;
  bpm: number;
  duration: number;
  difficulty: FortniteTrackDifficulty;
  gameplayTags: string[];
  genres: string[];
  albumArt: string;
  added: string;
  shopHistory: string[];
};

type FortniteTracksResponse = {
  status: number;
  data?: FortniteTrack[];
};

const TRACKS_API_URL = "https://fortnite-api.com/v2/cosmetics/tracks";

const normalizeText = (value?: string | null) => value?.trim() ?? "";

const formatDifficulty = (difficulty: FortniteTrackDifficulty) => {
  const parts = [
    `Vocals: ${difficulty.vocals}`,
    `Guitar: ${difficulty.guitar}`,
    `Bass: ${difficulty.bass}`,
    `Plastic Bass: ${difficulty.plasticBass}`,
    `Drums: ${difficulty.drums}`,
    `Plastic Drums: ${difficulty.plasticDrums}`,
  ];

  return parts.join(" • ");
};

const formatDuration = (duration?: number | null) => {
  if (!duration && duration !== 0) return "—";
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const transformTrack = (track: FortniteTrack, metadata?: { key: string; mode: string }): TrackRow => ({
  id: track.id,
  devName: track.devName,
  song: normalizeText(track.title),
  artist: normalizeText(track.artist),
  album: normalizeText(track.album),
  releaseYear: Number.isFinite(track.releaseYear) ? track.releaseYear : null,
  bpm: Number.isFinite(track.bpm) ? track.bpm : null,
  duration: Number.isFinite(track.duration) ? track.duration : null,
  difficulty: formatDifficulty(track.difficulty),
  genres: track.genres ?? [],
  gameplayTags: track.gameplayTags ?? [],
  albumArt: track.albumArt ?? "",
  added: track.added ?? "",
  shopHistory: track.shopHistory ?? [],
  key: metadata?.key ?? "",
  mode: metadata?.mode ?? "",
});

export const TRACK_COLUMNS = [
  { key: "song", label: "Song" },
  { key: "artist", label: "Artist" },
  { key: "album", label: "Album" },
  { key: "releaseYear", label: "Release year" },
  { key: "bpm", label: "BPM" },
  { key: "key", label: "Key" },
  { key: "duration", label: "Duration" },
  { key: "difficulty", label: "Difficulty" },
  { key: "genres", label: "Genres" },
  { key: "added", label: "Added" },
] as const;

export type TrackColumnKey = (typeof TRACK_COLUMNS)[number]["key"];

export async function fetchTrackData(): Promise<TrackRow[]> {
  const response = await fetch(TRACKS_API_URL, {
    next: { revalidate: 900 },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Fortnite tracks (status ${response.status}).`);
  }

  const payload = (await response.json()) as FortniteTracksResponse;

  if (payload.status !== 200) {
    throw new Error(`Fortnite API returned status ${payload.status}.`);
  }

  const sheetMetadata = await fetchSheetTrackMetadata();

  return (payload.data ?? []).map((track) => {
    const metadata = sheetMetadata.get(track.id.toLowerCase());
    return transformTrack(track, metadata);
  });
}
