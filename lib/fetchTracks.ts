import fs from "fs/promises";
import path from "path";

export type TrackDifficulty = {
  vocals: number;
  guitar: number;
  bass: number;
  drums: number;
  plasticVocals: number;
  plasticGuitar: number;
  plasticBass: number;
  plasticDrums: number;
};

export type TrackRow = {
  id: string;
  song: string;
  artist: string;
  album: string;
  releaseYear: number | null;
  bpm: number | null;
  duration: number | null;
  difficulty: TrackDifficulty;
  genres: string[];
  gameplayTags: string[];
  albumArt: string;
  added: string;
  shopHistory: string[];
  key: string;
  mode: string;
  previewUrl: string | null;
};

const TRACKS_FILE = path.join(process.cwd(), "data", "tracks.json");

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
  const raw = await fs.readFile(TRACKS_FILE, "utf-8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  delete parsed._metadata;
  return Object.values(parsed) as TrackRow[];
}