import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { newPicture } from "../src/picture";
import * as store from "../src/store";

beforeEach(async () => {
  await store.clearAll();
});

describe("store", () => {
  it("keeps a picture", async () => {
    const p = newPicture("trees", "Oak", 2, 2);
    p.px[1] = 0xff0000ff;
    await store.savePicture(p);
    const back = await store.getPicture(p.id);
    expect(back!.name).toBe("Oak");
    expect(back!.px[1]).toBe(0xff0000ff);
    expect(await store.listPictures()).toHaveLength(1);
  });

  it("queues uploads first in, first out, once each", async () => {
    await store.queueUpload("a");
    await store.queueUpload("b");
    await store.queueUpload("a");
    expect(await store.listQueue()).toEqual(["a", "b"]);
    await store.dequeue("a");
    expect(await store.listQueue()).toEqual(["b"]);
  });

  it("never deletes the built-in style", async () => {
    await store.saveStyle({ id: "game", name: "Game colours", groups: [], builtIn: true });
    await store.saveStyle({ id: "mine", name: "Autumn", groups: [], builtIn: false });
    expect(await store.deleteStyle("game")).toBe(false);
    expect(await store.deleteStyle("mine")).toBe(true);
    expect((await store.listStyles()).map((s) => s.id)).toEqual(["game"]);
  });

  it("keeps settings and categories", async () => {
    await store.setSetting("penOnly", true);
    expect(await store.getSetting("penOnly")).toBe(true);
    await store.cacheCategories({ categories: [{ id: "x", name: "X", sizes: [] }] });
    expect((await store.getCategories()).categories[0].id).toBe("x");
  });

  it("falls back to the starter categories when none are cached", async () => {
    const c = await store.getCategories();
    expect(c.categories.map((x) => x.id)).toEqual(["trees", "rocks", "bushes"]);
  });

  it("asks for persistent storage once", async () => {
    const persist = vi.fn(async () => true);
    vi.stubGlobal("navigator", { storage: { persist } });
    expect(await store.askPersist()).toBe(true);
    expect(await store.askPersist()).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
