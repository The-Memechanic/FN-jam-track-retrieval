const SHEET_ID = "1gHg1F9GkUsjN3xe7WFnW5r4-28fIOgzMXTQwSGlkD0Y";
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;

export type SheetTrackMetadata = {
  key: string;
  mode: string;
};

const normalizeCell = (value?: string | null) => value?.trim() ?? "";
const normalizeId = (value?: string | null) => normalizeCell(value).toLowerCase();

const parseCsv = (value: string) => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = "";
  let inQuotes = false;

  const pushValue = () => {
    currentRow.push(currentValue);
    currentValue = "";
  };

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (char === '"') {
      if (inQuotes && value[index + 1] === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      pushValue();
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && value[index + 1] === "\n") {
        index += 1;
      }
      pushValue();
      rows.push(currentRow);
      currentRow = [];
      continue;
    }

    currentValue += char;
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    pushValue();
    rows.push(currentRow);
  }

  return rows;
};

export async function fetchSheetTrackMetadata(): Promise<Map<string, SheetTrackMetadata>> {
  const response = await fetch(SHEET_CSV_URL, {
    next: { revalidate: 900 },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch sheet metadata (status ${response.status}).`);
  }

  const csvText = await response.text();
  const rows = parseCsv(csvText);
  const [headerRow, ...dataRows] = rows;

  if (!headerRow || headerRow.length === 0) {
    return new Map();
  }

  const idIndex = headerRow.findIndex((heading) => normalizeCell(heading).toLowerCase().includes("id"));
  const modeIndex = headerRow.findIndex((heading) => normalizeCell(heading).toLowerCase().includes("mode"));
  const keyIndex = headerRow.findIndex((heading) => normalizeCell(heading).toLowerCase().includes("key"));

  const mapping = new Map<string, SheetTrackMetadata>();

  dataRows.forEach((row) => {
    if (!row.length) return;

    const id = normalizeId(idIndex >= 0 ? row[idIndex] : undefined);
    if (!id) return;

    const metadata: SheetTrackMetadata = {
      key: normalizeCell(keyIndex >= 0 ? row[keyIndex] : undefined),
      mode: normalizeCell(modeIndex >= 0 ? row[modeIndex] : undefined),
    };

    mapping.set(id, metadata);
  });

  return mapping;
}
