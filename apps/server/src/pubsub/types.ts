/**
 * Cross-instance fan-out. When clients of one room are connected to different
 * server instances, each instance publishes the updates it receives from its own
 * clients and applies the updates published by the others.
 */
export type RoomBroadcast = { kind: "update" | "awareness"; data: Uint8Array };
export type RoomHandler = (msg: RoomBroadcast) => void;

export interface PubSub {
  readonly name: string;
  publish(roomId: string, msg: RoomBroadcast): Promise<void>;
  /** Returns an unsubscribe function that removes only this handler. */
  subscribe(roomId: string, handler: RoomHandler): Promise<() => Promise<void>>;
  close(): Promise<void>;
}
