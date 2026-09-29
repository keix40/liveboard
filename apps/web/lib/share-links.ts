import { viewCapability } from "./capabilities-server";

export function buildBoardLinks(roomId: string, jwtSecret: string, editCap: string): {
  editLink: string;
  viewLink: string;
  viewCap: string;
} {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const viewCap = viewCapability(roomId, jwtSecret);
  const editLink = `${origin}/board/${roomId}#edit=${encodeURIComponent(editCap)}`;
  const viewLink = `${origin}/board/${roomId}?view=1&viewCap=${encodeURIComponent(viewCap)}`;
  return { editLink, viewLink, viewCap };
}

export function parseEditCapFromHash(hash: string): string {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return "";
  const params = new URLSearchParams(raw);
  return params.get("edit") ?? "";
}

export const editCapStorageKey = (roomId: string) => `liveboard:edit:${roomId}`;

export function persistEditCap(roomId: string, cap: string): void {
  try {
    localStorage.setItem(editCapStorageKey(roomId), cap);
  } catch {
    /* ignore */
  }
}

export function loadStoredEditCap(roomId: string): string {
  try {
    return localStorage.getItem(editCapStorageKey(roomId)) ?? sessionStorage.getItem(editCapStorageKey(roomId)) ?? "";
  } catch {
    return "";
  }
}
