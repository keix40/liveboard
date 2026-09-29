"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isValidRoomId } from "@liveboard/shared";

function randomRoomId() {
  return Math.random().toString(36).slice(2, 10);
}

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
        <button className="btn" type="button" onClick={() => router.push(`/board/${randomRoomId()}`)}>
          New board
        </button>
      </form>
    </main>
  );
}
