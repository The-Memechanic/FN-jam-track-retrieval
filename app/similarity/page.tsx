import SimilaritySearchClient from "@/components/SimilaritySearchClient";

export default function SimilarityPage() {
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-12">
      <div className="mx-auto mb-8 max-w-4xl text-center">
        <h1 className="text-3xl font-semibold text-neutral-900">Similarity-based track matching</h1>
        <p className="mt-2 text-neutral-600">
          Search for a song, pick a result, and compare it against similar tracks using key and BPM.
        </p>
      </div>
      <SimilaritySearchClient />
    </main>
  );
}
