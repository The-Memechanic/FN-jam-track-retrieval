import { NextResponse } from "next/server";
import { fetchSheetData } from "@/lib/fetchSheet";

export async function GET() {
  try {
    const rows = await fetchSheetData();
    return NextResponse.json({ rows, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
