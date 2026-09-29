"use client";

import type { Peer } from "@/lib/useRoom";
import type { Camera } from "@/lib/camera";
import { worldToScreen } from "@/lib/camera";

/** Remote cursors from the awareness protocol (world coordinates → screen). */
export function Cursors({ peers, camera }: { peers: Peer[]; camera: Camera }) {
  return (
    <>
      {peers.map((p) => {
        if (!p.cursor) return null;
        const { x, y } = worldToScreen(camera, p.cursor.x, p.cursor.y);
        return (
          <div
            key={p.clientId}
            className="cursor"
            style={{ transform: `translate(${x}px, ${y}px)` }}
            aria-hidden
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path d="M1 1 L17 7 L10 10 L7 17 Z" fill={p.user.color} stroke="white" strokeWidth="1.5" />
            </svg>
            <span className="cursor-label" style={{ background: p.user.color }}>
              {p.user.name}
            </span>
          </div>
        );
      })}
    </>
  );
}
