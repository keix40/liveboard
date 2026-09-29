import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { writeBoardMeta } from "./board-meta";
import { lockedEntitiesMutated, lockedEntityFingerprints } from "./locking";
import { LOCAL_ORIGIN } from "./strokes";
import { writeStrokes } from "./page-model";

describe("locking undo guard", () => {
  it("detects when a locked stroke would change", () => {
    const doc = new Y.Doc();
    writeBoardMeta(doc, { lockedIds: ["s-1"] }, LOCAL_ORIGIN);
    const stroke = new Y.Map<unknown>();
    stroke.set("id", "s-1");
    const pts = new Y.Array<number>();
    pts.push([0, 0, 0.5]);
    stroke.set("points", pts);
    writeStrokes(doc).push([stroke]);
    const before = lockedEntityFingerprints(doc);
    pts.push([1, 1, 0.5]);
    expect(lockedEntitiesMutated(doc, before)).toBe(true);
  });
});
