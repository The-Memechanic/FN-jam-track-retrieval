import SearchClient from "@/components/SearchClient";

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-12">
      <h1 className="text-3xl font-semibold text-center mb-2">
        Fortnite Jam Track Search
      </h1>
      <p className="text-center text-neutral-500 mb-8">
        Search for Fortnite Jam Tracks and find the information you need.
      </p>

      <SearchClient />
    </main>
  );
}
