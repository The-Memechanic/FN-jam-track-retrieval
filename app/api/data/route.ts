import { NextResponse } from "next/server";
import { fetchTrackData } from "@/lib/fetchTracks";

export async function GET() {
  try {
    const rows = await fetchTrackData();
    return NextResponse.json({ rows, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
