"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaGithub, FaTwitter } from "react-icons/fa";

const NAV_LINKS = [
  { href: "/", label: "Search" },
  { href: "/similarity", label: "Similarity Search" },
] as const;

const SOCIAL_LINKS = [
  {
    href: "https://github.com/The-Memechanic/FN-jam-track-retrieval",
    label: "GitHub",
    icon: FaGithub,
  },
  {
    href: "https://twitter.com/Memechanic",
    label: "Twitter",
    icon: FaTwitter,
  },
] as const;

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-border-muted bg-bg-dark/80 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-3 items-center px-4 py-3">
        {/* Left: Title */}
        <Link
          href="/"
          className="justify-self-start text-lg font-semibold tracking-tight text-text"
        >
          Fortnite Jam Tracks
        </Link>

        {/* Center: Navigation */}
        <nav className="justify-self-center flex items-center gap-1 rounded-lg border border-border-muted bg-bg-light p-1">
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

        {/* Right: Social links */}
        <div className="justify-self-end flex items-center gap-1">
          {SOCIAL_LINKS.map((social) => {
            const Icon = social.icon;

            return (
              <Link
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="rounded-md p-2 text-text-muted transition hover:bg-bg-light hover:text-text"
              >
                <Icon size={18} />
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}