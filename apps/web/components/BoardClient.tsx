"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { RoomRole } from "@liveboard/shared";
import { BoardPasswordPrompt } from "./BoardPasswordPrompt";
import { Whiteboard } from "./Whiteboard";

export function BoardClient({ roomId }: { roomId: string }) {
  const params = useSearchParams();
  const requestedRole: RoomRole = params.get("view") === "1" ? "viewer" : "editor";
  const editCap = params.get("edit") ?? "";
  const viewCap = params.get("viewCap") ?? "";
  const claim = params.get("claim") === "1";
  const needsPassword = useMemo(
    () => Boolean(process.env.NEXT_PUBLIC_BOARD_PASSWORD_REQUIRED === "1"),
    [],
  );
  const [password, setPassword] = useState<string | null>(needsPassword ? null : "");

  if (needsPassword && password === null) {
    return <BoardPasswordPrompt onSubmit={(p) => setPassword(p)} />;
  }

  return (
    <Whiteboard
      roomId={roomId}
      requestedRole={requestedRole}
      boardPassword={password ?? ""}
      editCap={editCap}
      viewCap={viewCap}
      claimBoard={claim}
    />
  );
}
