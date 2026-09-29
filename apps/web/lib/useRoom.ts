"use client";

import { useEffect, useState } from "react";
import type { AwarenessState, RoomRole } from "@liveboard/shared";
import { getIdentity, type Identity } from "./identity";
import { createRoomConnection, type ConnectionStatus, type RoomConnection } from "./room-connection";

export interface Peer extends AwarenessState {
  clientId: number;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:1234";

export function useRoom(
  roomId: string,
  opts?: {
    role?: RoomRole;
    boardPassword?: string | null;
    editCap?: string;
    viewCap?: string;
    onPasswordRequired?: () => void;
    onEditAccessDenied?: (message: string) => void;
  },
) {
  const [conn, setConn] = useState<RoomConnection | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [peers, setPeers] = useState<Peer[]>([]);
  const [roomRole, setRoomRole] = useState<RoomRole>(opts?.role ?? "editor");

  useEffect(() => {
    const me = getIdentity();
    const c = createRoomConnection({
      roomId,
      identity: me,
      wsUrl: WS_URL,
      role: opts?.role ?? "editor",
      boardPassword: opts?.boardPassword ?? null,
      editCap: opts?.editCap ?? "",
      viewCap: opts?.viewCap ?? "",
      onStatus: setStatus,
      onRole: setRoomRole,
      onPasswordRequired: opts?.onPasswordRequired,
      onEditAccessDenied: opts?.onEditAccessDenied,
      onTokenUserId: (userId) => {
        setIdentity({ ...me, id: userId });
      },
    });
    const awareness = c.provider.awareness;
    const onChange = () => {
      const list: Peer[] = [];
      awareness.getStates().forEach((state, clientId) => {
        if (clientId !== awareness.clientID && state.user) list.push({ ...(state as AwarenessState), clientId });
      });
      setPeers(list);
    };
    awareness.on("change", onChange);
    setIdentity(me);
    setConn(c);
    return () => {
      awareness.off("change", onChange);
      c.destroy();
      setConn(null);
    };
  }, [
    roomId,
    opts?.role,
    opts?.boardPassword,
    opts?.editCap,
    opts?.viewCap,
    opts?.onPasswordRequired,
    opts?.onEditAccessDenied,
  ]);

  return { conn, identity, status, peers, roomRole, setRoomRole };
}
