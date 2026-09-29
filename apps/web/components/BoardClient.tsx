"use client";

import { useSearchParams } from "next/navigation";
import type { RoomRole } from "@liveboard/shared";
import { Whiteboard } from "./Whiteboard";

export function BoardClient({ roomId }: { roomId: string }) {
  const params = useSearchParams();
  const requestedRole: RoomRole = params.get("view") === "1" ? "viewer" : "editor";
  const boardPassword = params.get("password");
  return <Whiteboard roomId={roomId} requestedRole={requestedRole} boardPassword={boardPassword} />;
}
