"use client";

import type { Peer } from "@/lib/useRoom";

/** Remote cursors from the awareness protocol, rendered as absolutely positioned DOM nodes. */
export function Cursors({ peers }: { peers: Peer[] }) {
  return (
    <>
      {peers.map((p) =>
        p.cursor ? (
          <div
            key={p.clientId}
            className="cursor"
            style={{ transform: `translate(${p.cursor.x}px, ${p.cursor.y}px)` }}
            aria-hidden
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path d="M1 1 L17 7 L10 10 L7 17 Z" fill={p.user.color} stroke="white" strokeWidth="1.5" />
            </svg>
            <span className="cursor-label" style={{ background: p.user.color }}>
              {p.user.name}
            </span>
          </div>
        ) : null,
      )}
    </>
  );
}
