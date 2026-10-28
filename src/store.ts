// Everything the app keeps lives on the tablet, in IndexedDB.
import { type Categories, isCategories, STARTER } from "./categories";
import type { Group } from "./gameColours";
import type { Picture } from "./picture";

export type Style = { id: string; name: string; groups: Group[]; builtIn: boolean };

const STORES = ["pictures", "styles", "kv"] as const;
let dbp: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  dbp ??= new Promise((ok, fail) => {
    const r = indexedDB.open("land-empires-draw", 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore("pictures", { keyPath: "id" });
      r.result.createObjectStore("styles", { keyPath: "id" });
      r.result.createObjectStore("kv");
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fail(r.error);
  });
  return dbp;
}

function done<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((ok, fail) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fail(r.error);
  });
}

async function os(name: (typeof STORES)[number], mode: IDBTransactionMode = "readonly"): Promise<IDBObjectStore> {
  return (await db()).transaction(name, mode).objectStore(name);
}

export async function savePicture(p: Picture): Promise<void> {
  await done((await os("pictures", "readwrite")).put(p));
}

export async function getPicture(id: string): Promise<Picture | undefined> {
  return done((await os("pictures")).get(id));
}

export async function listPictures(): Promise<Picture[]> {
  return done((await os("pictures")).getAll());
}

// The upload queue is one list of picture ids, read and written in one transaction so it stays in order.
async function editQueue(f: (q: string[]) => string[]): Promise<string[]> {
  const s = await os("kv", "readwrite");
  const q = f(((await done(s.get("queue"))) as string[] | undefined) ?? []);
  await done(s.put(q, "queue"));
  return q;
}

export async function queueUpload(id: string): Promise<void> {
  await editQueue((q) => (q.includes(id) ? q : [...q, id]));
}

export async function listQueue(): Promise<string[]> {
  return ((await done((await os("kv")).get("queue"))) as string[] | undefined) ?? [];
}

export async function dequeue(id: string): Promise<void> {
  await editQueue((q) => q.filter((x) => x !== id));
}

export async function saveStyle(s: Style): Promise<void> {
  await done((await os("styles", "readwrite")).put(s));
}

export async function listStyles(): Promise<Style[]> {
  return done((await os("styles")).getAll());
}

export async function deleteStyle(id: string): Promise<boolean> {
  const s = (await done((await os("styles")).get(id))) as Style | undefined;
  if (!s || s.builtIn) return false;
  await done((await os("styles", "readwrite")).delete(id));
  return true;
}

export async function getSetting<T>(k: string): Promise<T | undefined> {
  return (await done((await os("kv")).get(`setting:${k}`))) as T | undefined;
}

export async function setSetting(k: string, v: unknown): Promise<void> {
  await done((await os("kv", "readwrite")).put(v, `setting:${k}`));
}

export async function cacheCategories(c: Categories): Promise<void> {
  await done((await os("kv", "readwrite")).put(c, "categories"));
}

export async function getCategories(): Promise<Categories> {
  const c = await done((await os("kv")).get("categories"));
  return isCategories(c) ? c : STARTER;
}

// Asks Android not to clear the app's data when space runs low. A yes is kept; a no is asked again next start (Chrome may say yes once installed).
export async function askPersist(): Promise<boolean> {
  if (await getSetting<boolean>("persisted")) return true;
  const ok = (await navigator.storage?.persist?.()) ?? false;
  await setSetting("persisted", ok);
  return ok;
}

// Used by tests only.
export async function clearAll(): Promise<void> {
  for (const n of STORES) await done((await os(n, "readwrite")).clear());
}
