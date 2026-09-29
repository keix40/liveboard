import { colorForId } from "@liveboard/shared";

export interface Identity {
  id: string;
  name: string;
  color: string;
}

const KEY = "liveboard:identity";
const ADJECTIVES = ["Swift", "Calm", "Bright", "Bold", "Quiet", "Lucky", "Clever", "Sunny"];
const ANIMALS = ["Otter", "Falcon", "Panda", "Lynx", "Koala", "Heron", "Fox", "Tiger"];

const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)]!;

/** Guest identity persisted in localStorage so reloads keep the same cursor name/color. */
export function getIdentity(): Identity {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) return JSON.parse(stored) as Identity;
  } catch {
    /* private mode / corrupted value */
  }
  const id = crypto.randomUUID();
  const identity = { id, name: `${pick(ADJECTIVES)} ${pick(ANIMALS)}`, color: colorForId(id) };
  try {
    localStorage.setItem(KEY, JSON.stringify(identity));
  } catch {
    /* ignore */
  }
  return identity;
}
