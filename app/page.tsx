import SearchClient from "@/components/SearchClient";

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8 text-neutral-900 transition-colors dark:bg-neutral-900 dark:text-neutral-100">
      <SearchClient />
    </main>
  );
}