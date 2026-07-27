import SearchClient from "@/components/SearchClient";

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-12">
      <h1 className="text-3xl font-semibold text-center mb-2">
        Fortnite Jam Track Search
      </h1>
      <p className="text-center text-neutral-500 mb-6">
        Search for Fortnite Jam Tracks and find the information you need.
      </p>
      <div className="mb-8 flex justify-center">
        <a
          href="/similarity"
          className="inline-flex items-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
        >
          Try similarity-based matching
        </a>
      </div>

      <SearchClient />
    </main>
  );
}
