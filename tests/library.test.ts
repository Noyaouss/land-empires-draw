import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getFile } from "../src/github";
import { findLocal, groupItems, isLibIndex, isStale, type LibItem, toPicture } from "../src/library";
import { newPicture } from "../src/picture";
import { decodePng, encodePng } from "../src/png";

const item = (category: string, file: string, group: string, label: string): LibItem => ({ category, file, group, label, w: 2, h: 2 });
const items = [
  item("trees", "oak-1", "oak", "Oak 1"), item("trees", "oak-2", "oak", "Oak 2"), item("trees", "pine-1", "pine", "Pine 1"),
  item("rocks", "boulder-angular-1", "boulder-angular", "Boulder 1"),
];

afterEach(() => vi.unstubAllGlobals());

describe("decodePng", () => {
  it("round trips with encodePng, keeping size and see-through pixels", async () => {
    const px = new Uint32Array([0xff0000ff, 0, 0x00ff0080, 0x12345678, 0xffffffff, 0, 0xabcdef01, 0x01020304, 1, 2, 3, 4]);
    const back = await decodePng(await encodePng(4, 3, px));
    expect([back.w, back.h]).toEqual([4, 3]);
    expect([...back.px]).toEqual([...px]);
  });
  it("rejects junk", async () => {
    await expect(decodePng(new Uint8Array(40))).rejects.toThrow();
  });
});

describe("thumb staleness", () => {
  it("is stale when the repo sha differs or the cache has none", () => {
    expect(isStale("old", "new")).toBe(true);
    expect(isStale(undefined, "new")).toBe(true);
  });
  it("is fresh when the shas match or the repo sha is unknown", () => {
    expect(isStale("same", "same")).toBe(false);
    expect(isStale("old", undefined)).toBe(false);
    expect(isStale(undefined, undefined)).toBe(false);
  });
});

describe("library list", () => {
  it("groups one category in order", () => {
    expect(groupItems(items, "trees").map(([g, l]) => [g, l.length])).toEqual([["oak", 2], ["pine", 1]]);
    expect(groupItems(items, "wood")).toEqual([]);
  });
  it("filters by label or group, all words must match", () => {
    expect(groupItems(items, "trees", "OAK 2")[0][1].map((i) => i.file)).toEqual(["oak-2"]);
    expect(groupItems(items, "rocks", "angular")).toHaveLength(1);
    expect(groupItems(items, "trees", "oak pine")).toEqual([]);
  });
  it("checks the index shape", () => {
    expect(isLibIndex({ scale: "x", items })).toBe(true);
    expect(isLibIndex({ items: [{ category: "trees" }] })).toBe(false);
  });
});

describe("local lookup", () => {
  it("finds a picture with the same category and name, not a sheet", () => {
    const mine = newPicture("trees", "Oak-1", 2, 2);
    expect(findLocal([mine], items[0])).toBe(mine);
    expect(findLocal([mine], items[1])).toBeUndefined();
    expect(findLocal([newPicture("rocks", "oak-1", 2, 2)], items[0])).toBeUndefined();
    expect(findLocal([{ ...mine, sheet: true }], items[0])).toBeUndefined();
  });
  it("opens a download under the same repo path", () => {
    const p = toPicture(items[0], { w: 2, h: 1, px: new Uint32Array([1, 2]) });
    expect([p.category, p.name, p.w, p.h]).toEqual(["trees", "oak-1", 2, 1]);
  });
});

describe("getFile", () => {
  it("names the failure in plain kinds", async () => {
    const reply = (r: Response) => vi.stubGlobal("fetch", vi.fn(async () => r));
    reply(new Response("", { status: 403, headers: { "x-ratelimit-remaining": "0" } }));
    expect(await getFile("k", "a")).toBe("limit");
    reply(new Response("", { status: 401 }));
    expect(await getFile("k", "a")).toBe("auth");
    reply(new Response("", { status: 404 }));
    expect(await getFile("k", "a")).toBe("missing");
    reply(new Response(JSON.stringify({ content: btoa("hi") })));
    expect([...(await getFile("k", "a")) as Uint8Array]).toEqual([104, 105]);
  });
});
