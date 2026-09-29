"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isValidRoomId } from "@liveboard/shared";

export default function Home() {
  const router = useRouter();
  const [room, setRoom] = useState("");
  const valid = isValidRoomId(room);

  return (
    <main className="landing">
      <h1>LiveBoard</h1>
      <p>A multiplayer whiteboard. Share the link, draw together, keep working offline.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) router.push(`/board/${room}`);
        }}
      >
        <input
          placeholder="room-name (3-64 chars: a-z 0-9 _ -)"
          value={room}
          onChange={(e) => setRoom(e.target.value.trim())}
          aria-label="Room name"
        />
        <button className="btn secondary" type="submit" disabled={!valid}>
          Join
        </button>
        <button
          className="btn"
          type="button"
          onClick={async () => {
            const res = await fetch("/api/rooms/create", { method: "POST" });
            if (!res.ok) return;
            const data = (await res.json()) as {
              room?: string;
              editCap?: string;
              editLink?: string;
              viewLink?: string;
            };
            if (!data.room || !data.editCap) return;
            try {
              localStorage.setItem(`liveboard:edit:${data.room}`, data.editCap);
              if (data.editLink && data.viewLink) {
                sessionStorage.setItem(
                  `liveboard:share:${data.room}`,
                  JSON.stringify({ editLink: data.editLink, viewLink: data.viewLink }),
                );
              }
            } catch {
              /* ignore */
            }
            router.push(`/board/${data.room}?shared=1`);
          }}
        >
          New board
        </button>
      </form>
    </main>
  );
}
