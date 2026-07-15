import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fortnite Jam Track Search",
  description: "Search for Fortnite Jam Tracks and find the information you need.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
