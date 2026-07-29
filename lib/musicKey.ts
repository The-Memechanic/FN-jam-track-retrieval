const PITCH_CLASS_LABELS = [
  "C",
  "C♯/D♭",
  "D",
  "D♯/E♭",
  "E",
  "F",
  "F♯/G♭",
  "G",
  "G♯/A♭",
  "A",
  "A♯/B♭",
  "B",
] as const;

const PITCH_CLASS_MAP: Record<string, number> = {
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

export const getPitchClass = (value?: string | null): number | null => {
  const raw = value?.trim() ?? "";
  if (!raw) return null;

  const normalized = raw
    .replace(/[♯#]/g, "#")
    .replace(/[♭b]/g, "b")
    .replace(/\s+/g, "")
    .toUpperCase();

  const tokens = normalized.split("/").filter(Boolean);

  for (const token of tokens) {
    const pitch = PITCH_CLASS_MAP[token];
    if (pitch !== undefined) return pitch;
  }

  return null;
};

/** "Db" | "C#" | "c# / db" -> "C♯/D♭". Falls back to the raw value if unrecognized. */
export const formatKeyLabel = (value?: string | null): string => {
  const pitchClass = getPitchClass(value);
  if (pitchClass === null) return value?.trim() || "";
  return PITCH_CLASS_LABELS[pitchClass];
};