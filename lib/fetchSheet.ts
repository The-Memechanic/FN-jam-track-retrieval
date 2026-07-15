import Papa from "papaparse";

// Google Sheet ID
const SHEET_ID = "1gHg1F9GkUsjN3xe7WFnW5r4-28fIOgzMXTQwSGlkD0Y";

const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;

const RAW_SHEET_KEYS = [
  "song_with_artist",
  "source",
  "state",
  "id",
  "mode",
  "bpm",
  "key",
  "earliest_development_time",
  "announce_date",
  "extra_info",
] as const;

export const SHEET_COLUMNS = [
  { key: "song", label: "Song" },
  { key: "artist", label: "Artist" },
  { key: "source", label: "Source" },
  { key: "state", label: "State" },
  { key: "id", label: "ID" },
  { key: "mode", label: "Mode" },
  { key: "bpm", label: "BPM" },
  { key: "key", label: "Key" },
  { key: "earliest_development_time", label: "Earliest Development Date" },
  { key: "announce_date", label: "Announcement Date" },
  { key: "extra_info", label: "Extra Info" },
] as const;

export type RawSheetColumnKey = (typeof RAW_SHEET_KEYS)[number];
export type SheetColumnKey = (typeof SHEET_COLUMNS)[number]["key"];
export type SheetRow = Record<SheetColumnKey, string> & { song_with_artist: string };

function splitSongWithArtist(value: string) {
  const trimmed = value.trim();
  const normalized = trimmed.replace(/[–—−]/g, "-");
  const match = normalized.match(/^\s*(.*?)\s*-\s*(.*)$/);
  if (match) {
    return {
      artist: match[1].trim(),
      song: match[2].trim(),
    };
  }

  return {
    artist: "",
    song: normalized,
  };
}

/**
 * Fetches the sheet as CSV and returns an array of row objects keyed by
 * normalized column names.
 */
export async function fetchSheetData(): Promise<SheetRow[]> {
  const res = await fetch(SHEET_CSV_URL, {
    // re-fetch at most once every 15 minutes.
    next: { revalidate: 900 },
  });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch sheet (status ${res.status}). Check its permissions.`
    );
  }

  const csvText = await res.text();

  const parsed = Papa.parse<string[]>(csvText, {
    skipEmptyLines: true,
  });

  const [headerRow, ...dataRows] = parsed.data;
  if (!headerRow) {
    throw new Error("Sheet header row is missing or malformed.");
  }

  const headers = RAW_SHEET_KEYS;
  const rows: SheetRow[] = dataRows.map((row) => {
    const obj = {} as SheetRow;
    headers.forEach((key, i) => {
      obj[key] = (row[i] ?? "").trim();
    });

    const { song, artist } = splitSongWithArtist(obj.song_with_artist);
    obj.song = song;
    obj.artist = artist;

    return obj;
  });

  return rows;
}
