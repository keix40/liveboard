"use client";

import { useEffect, useState } from "react";
import type { AwarenessState } from "@liveboard/shared";
import { getIdentity, type Identity } from "./identity";
import { createRoomConnection, type ConnectionStatus, type RoomConnection } from "./room-connection";

export interface Peer extends AwarenessState {
  clientId: number;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:1234";

/** React binding for a room: connection lifecycle + reactive status and presence. */
export function useRoom(roomId: string) {
  const [conn, setConn] = useState<RoomConnection | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [peers, setPeers] = useState<Peer[]>([]);

  useEffect(() => {
    const me = getIdentity();
    const c = createRoomConnection({ roomId, identity: me, wsUrl: WS_URL, onStatus: setStatus });
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
  }, [roomId]);

  return { conn, identity, status, peers };
}
