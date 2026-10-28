import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { newPicture } from "../src/picture";
import * as store from "../src/store";
import { refreshCategories, runQueue } from "../src/sync";

const KEY = "github_pat_SECRET123";

async function queued(name: string) {
  const p = newPicture("trees", name, 2, 2);
  await store.savePicture(p);
  await store.queueUpload(p.id);
  return p;
}

// Each upload is a GET (file id) then a PUT; `put` gives the PUT status per picture.
function server(put: (number | "offline")[]) {
  const urls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    urls.push(url);
    if (!init || init.method !== "PUT") return new Response("", { status: 404 });
    const s = put.shift()!;
    if (s === "offline") throw new TypeError("Failed to fetch");
    return new Response("{}", { status: s });
  }));
  return urls;
}

beforeEach(async () => store.clearAll());
afterEach(() => vi.unstubAllGlobals());

describe("runQueue", () => {
  it("sends waiting pictures and marks them sent, keeping them on the tablet", async () => {
    const a = await queued("Big Oak");
    const urls = server([201]);
    expect(await runQueue(KEY)).toEqual({ sent: 1, waiting: 0, keyBad: false });
    expect(urls.at(-1)).toBe("https://api.github.com/repos/Noyaouss/land-empires-art/contents/items/trees/big-oak.png");
    expect((await store.getPicture(a.id))!.sent).toBe(true);
    expect(await store.listQueue()).toEqual([]);
  });

  it("keeps a failed picture waiting and still tries the next one", async () => {
    const a = await queued("a");
    const b = await queued("b");
    server(["offline", 201]);
    expect(await runQueue(KEY)).toEqual({ sent: 1, waiting: 1, keyBad: false });
    expect(await store.listQueue()).toEqual([a.id]);
    expect((await store.getPicture(a.id))!.sent).toBe(false);
    expect((await store.getPicture(b.id))!.sent).toBe(true);
  });

  it("stops on a bad key and loses nothing", async () => {
    await queued("a");
    await queued("b");
    server([401, 201]);
    expect(await runQueue(KEY)).toEqual({ sent: 0, waiting: 2, keyBad: true });
    expect(await store.listQueue()).toHaveLength(2);
    expect(await store.listPictures()).toHaveLength(2);
  });

  it("keeps a picture waiting when it was saved again during its upload", async () => {
    const a = await queued("a");
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method !== "PUT") return new Response("", { status: 404 });
      await store.savePicture({ ...a, updated: a.updated + 1 });
      return new Response("{}", { status: 201 });
    }));
    expect(await runQueue(KEY)).toEqual({ sent: 0, waiting: 1, keyBad: false });
    expect((await store.getPicture(a.id))!.sent).toBe(false);
  });

  it("drops a queue entry whose picture is gone", async () => {
    await store.queueUpload("missing");
    server([]);
    expect(await runQueue(KEY)).toEqual({ sent: 0, waiting: 0, keyBad: false });
  });

  it("never puts the key in an error", async () => {
    await queued("a");
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("boom");
    }));
    const r = await runQueue(KEY);
    expect(JSON.stringify(r)).not.toContain("SECRET");
  });
});

describe("refreshCategories", () => {
  it("caches good categories and ignores bad ones", async () => {
    const good = { categories: [{ id: "x", name: "X", sizes: [{ name: "s", w: 16, h: 16 }] }] };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ content: btoa(JSON.stringify(good)) }))));
    await refreshCategories(KEY);
    expect((await store.getCategories()).categories[0].id).toBe("x");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ content: btoa("{\"nope\":1}") }))));
    await refreshCategories(KEY);
    expect((await store.getCategories()).categories[0].id).toBe("x");
  });
});
