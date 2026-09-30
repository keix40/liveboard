"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { RoomRole } from "@liveboard/shared";
import { BoardPasswordPrompt } from "./BoardPasswordPrompt";
import { Whiteboard } from "./Whiteboard";
import {
  loadStoredEditCap,
  parseEditCapFromHash,
  persistEditCap,
} from "@/lib/share-links";

export function BoardClient({ roomId }: { roomId: string }) {
  const params = useSearchParams();
  const requestedRole: RoomRole = params.get("view") === "1" ? "viewer" : "editor";
  const viewCap = params.get("viewCap") ?? "";
  const showShare = params.get("shared") === "1";

  const [password, setPassword] = useState("");
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [editCapResolved, setEditCapResolved] = useState("");
  const [shareLinks, setShareLinks] = useState<{ editLink: string; viewLink: string } | null>(null);
  const [editAccessBanner, setEditAccessBanner] = useState<string | null>(null);

  useEffect(() => {
    const fromHash = parseEditCapFromHash(window.location.hash);
    const stored = loadStoredEditCap(roomId);
    const cap = fromHash || stored || params.get("edit") || "";
    if (fromHash) persistEditCap(roomId, fromHash);
    if (cap) setEditCapResolved(cap);
  }, [roomId, params]);

  useEffect(() => {
    const origin = window.location.origin;
    let editLink = "";
    let viewLink = "";
    try {
      const raw = sessionStorage.getItem(`liveboard:share:${roomId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as { editLink?: string; viewLink?: string };
        if (parsed.editLink) editLink = parsed.editLink;
        if (parsed.viewLink) viewLink = parsed.viewLink;
      }
    } catch {
      /* ignore */
    }
    const cap = editCapResolved || loadStoredEditCap(roomId);
    if (cap) {
      editLink = `${origin}/board/${roomId}#edit=${encodeURIComponent(cap)}`;
    }
    const vc = params.get("viewCap") ?? "";
    if (vc) {
      viewLink = `${origin}/board/${roomId}?view=1&viewCap=${encodeURIComponent(vc)}`;
    }
    if (showShare && !editLink && !viewLink) return;
    if (editLink && viewLink) setShareLinks({ editLink, viewLink });
    else if (editLink || viewLink) {
      setShareLinks({ editLink: editLink || viewLink, viewLink: viewLink || editLink });
    }
  }, [showShare, roomId, editCapResolved, params]);

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
      shareLinks={shareLinks}
      editAccessBanner={editAccessBanner}
      onEditAccessDenied={(msg) => setEditAccessBanner(msg)}
      onPasswordRequired={() => setPasswordRequired(true)}
    />
  );
}
