"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Search" },
  { href: "/similarity", label: "Similarity Search" },
] as const;

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-border-muted bg-bg-dark/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-text"
        >
          Fortnite Jam Tracks
        </Link>

        <nav className="flex items-center gap-1 rounded-lg border border-border-muted bg-bg-light p-1">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-primary text-bg-dark"
                    : "text-text-muted hover:bg-bg-dark hover:text-text"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}