import { mkdir, readFile, writeFile, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { Logger } from "../logger.js";
import type { DocPersistence } from "./types.js";
import { foldUpdates } from "./merge.js";

/**
 * File-backed persistence for free-tier deploys without Postgres.
 * Stores one snapshot + append-only update files per room under DATA_DIR.
 * Works across process restarts when the filesystem is durable (local dev; same Render instance between redeploys).
 */
export class FilePersistence implements DocPersistence {
  readonly name = "file";
  private readonly root: string;

  constructor(
    dataDir: string,
    private readonly log: Logger,
  ) {
    this.root = dataDir;
  }

  private roomDir(roomId: string): string {
    return join(this.root, roomId);
  }

  private snapshotPath(roomId: string): string {
    return join(this.roomDir(roomId), "snapshot.bin");
  }

  private updatesDir(roomId: string): string {
    return join(this.roomDir(roomId), "updates");
  }

  async init(): Promise<void> {
    await mkdir(this.root, { recursive: true });
    this.log.info("file persistence ready", { dataDir: this.root });
  }

  async load(roomId: string): Promise<Uint8Array | null> {
    let snapshot: Uint8Array | null = null;
    try {
      snapshot = new Uint8Array(await readFile(this.snapshotPath(roomId)));
    } catch {
      /* no snapshot yet */
    }
    const updates: Uint8Array[] = [];
    try {
      const dir = this.updatesDir(roomId);
      const files = (await readdir(dir)).filter((f) => f.endsWith(".bin")).sort();
      for (const f of files) {
        updates.push(new Uint8Array(await readFile(join(dir, f))));
      }
    } catch {
      /* no updates yet */
    }
    return foldUpdates(snapshot, updates);
  }

  async storeUpdate(roomId: string, update: Uint8Array): Promise<void> {
    const dir = this.updatesDir(roomId);
    await mkdir(dir, { recursive: true });
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.bin`;
    await writeFile(join(dir, name), update);
  }

  async compact(roomId: string): Promise<void> {
    const merged = await this.load(roomId);
    if (!merged) return;
    await mkdir(this.roomDir(roomId), { recursive: true });
    await writeFile(this.snapshotPath(roomId), merged);
    try {
      const dir = this.updatesDir(roomId);
      const files = await readdir(dir);
      await Promise.all(files.map((f) => unlink(join(dir, f))));
    } catch {
      /* nothing to delete */
    }
  }

  async roomHasContent(roomId: string): Promise<boolean> {
    try {
      await readFile(this.snapshotPath(roomId));
      return true;
    } catch {
      /* no snapshot */
    }
    try {
      const files = await readdir(this.updatesDir(roomId));
      return files.some((f) => f.endsWith(".bin"));
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {}
}
