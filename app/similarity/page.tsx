import SimilaritySearchClient from "@/components/SimilaritySearchClient";

export default function SimilarityPage() {
  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-12 text-neutral-900 transition-colors dark:bg-neutral-900 dark:text-neutral-100">
      <h1 className="mb-2 text-center text-3xl font-semibold">Similarity-based track matching</h1>
      <p className="mb-6 text-center text-neutral-600 dark:text-neutral-400">
        Pick a track, customize the sliders, and find similar tracks based on your preferences.
      </p>
      <SimilaritySearchClient />
    </main>
  );
}
