import Link from "next/link";
import SearchClient from "@/components/SearchClient";

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-12 text-neutral-900 transition-colors dark:bg-neutral-900 dark:text-neutral-100">
      <h1 className="mb-2 text-center text-3xl font-semibold">
        Fortnite Jam Track Search
      </h1>
      <p className="mb-6 text-center text-neutral-600 dark:text-neutral-400">
        Search for Fortnite Jam Tracks and find the information you need.
      </p>
      <SearchClient />
    </main>
  );
}