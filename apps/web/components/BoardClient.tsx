"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { RoomRole } from "@liveboard/shared";
import { BoardPasswordPrompt } from "./BoardPasswordPrompt";
import { Whiteboard } from "./Whiteboard";

export function BoardClient({ roomId }: { roomId: string }) {
  const params = useSearchParams();
  const requestedRole: RoomRole = params.get("view") === "1" ? "viewer" : "editor";
  const editCap = params.get("edit") ?? "";
  const viewCap = params.get("viewCap") ?? "";
  const isNewBoard = params.get("new") === "1";
  const [password, setPassword] = useState("");
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [editCapResolved, setEditCapResolved] = useState(editCap);

  useEffect(() => {
    if (!isNewBoard || requestedRole !== "editor") return;
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/rooms/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ room: roomId }),
      });
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { editCap?: string };
      if (data.editCap) {
        try {
          sessionStorage.setItem(`liveboard:edit:${roomId}`, data.editCap);
        } catch {
          /* ignore */
        }
        setEditCapResolved(data.editCap);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isNewBoard, requestedRole, roomId]);

  if (passwordRequired) {
    return (
      <BoardPasswordPrompt
        onSubmit={(p) => {
          setPassword(p);
          setPasswordRequired(false);
        }}
      />
    );
  }

  return (
    <Whiteboard
      roomId={roomId}
      requestedRole={requestedRole}
      boardPassword={password}
      editCap={editCapResolved}
      viewCap={viewCap}
      onPasswordRequired={() => setPasswordRequired(true)}
    />
  );
}
