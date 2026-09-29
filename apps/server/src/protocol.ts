import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import { MessageType } from "@liveboard/shared";

/**
 * Frame encoders for the y-websocket wire protocol, so the stock
 * `y-websocket` WebsocketProvider can talk to this server unchanged.
 *
 *   [varUint messageType][payload...]
 *   Sync (0):      [varUint syncType: 0=step1 | 1=step2 | 2=update][varUint8Array data]
 *   Awareness (1): [varUint8Array awarenessUpdate]
 */
export function encodeSyncStep1(doc: Y.Doc): Uint8Array {
  const enc = encoding.createEncoder();
  encoding.writeVarUint(enc, MessageType.Sync);
  syncProtocol.writeSyncStep1(enc, doc);
  return encoding.toUint8Array(enc);
}

export function encodeUpdate(update: Uint8Array): Uint8Array {
  const enc = encoding.createEncoder();
  encoding.writeVarUint(enc, MessageType.Sync);
  syncProtocol.writeUpdate(enc, update);
  return encoding.toUint8Array(enc);
}

export function encodeAwareness(awareness: awarenessProtocol.Awareness, clients: number[]): Uint8Array {
  const enc = encoding.createEncoder();
  encoding.writeVarUint(enc, MessageType.Awareness);
  encoding.writeVarUint8Array(enc, awarenessProtocol.encodeAwarenessUpdate(awareness, clients));
  return encoding.toUint8Array(enc);
}
