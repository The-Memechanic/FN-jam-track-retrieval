import fs from "fs/promises";

const SPARK_TRACKS_URL =
  "https://fortnitecontent-website-prod07.ol.epicgames.com/content/api/pages/fortnite-game/spark-tracks";

async function main() {
  const res = await fetch(SPARK_TRACKS_URL);
  const payload = await res.json();
  const entry = Object.values(payload).find((v) => v?.track);

  if (!entry) {
    console.log("No track entries found.");
    return;
  }

  console.log(JSON.stringify(entry.track, null, 2));
  await fs.writeFile("sample-track.json", JSON.stringify(entry.track, null, 2));
  console.log("\nAlso saved to sample-track.json");
}

main();