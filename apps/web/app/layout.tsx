import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LiveBoard — multiplayer whiteboard",
  description: "Draw together in real time. Yjs CRDT sync, live cursors, offline-first.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
