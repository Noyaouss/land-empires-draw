// The game's own pictures, listed in items/library.json of the art repo. Browsing, searching and opening them.
import { getFile, type GetResult } from "./github";
import { newPicture, type Picture, picturePath, safeName } from "./picture";
import { decodePng } from "./png";
import * as store from "./store";

export type LibItem = { category: string; file: string; group: string; label: string; w: number; h: number };
export type LibIndex = { scale?: string; items: LibItem[] };
export type Thumb = { w: number; h: number; px: Uint32Array; sha?: string };

export const LIB_CATEGORIES = [["trees", "Trees"], ["bushes", "Bushes"], ["plants", "Plants"], ["rocks", "Rocks"], ["wood", "Wood"], ["people", "People"], ["animals", "Animals"], ["camp", "Camp"]] as const;

export function isLibIndex(v: unknown): v is LibIndex {
  const items = (v as LibIndex)?.items;
  return Array.isArray(items) && items.every((i) => typeof i?.category === "string" && typeof i.file === "string"
    && typeof i.group === "string" && typeof i.label === "string" && Number.isInteger(i.w) && Number.isInteger(i.h));
}

export const stem = (i: LibItem) => i.file.replace(/\.png$/i, "");
export const itemPath = (i: LibItem) => `items/${i.category}/${stem(i)}.png`;

// Items of one category matching the search words (label or group), grouped under their group name, in file order.
export function groupItems(items: LibItem[], category: string, search = ""): [string, LibItem[]][] {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const groups = new Map<string, LibItem[]>();
  for (const i of items) {
    if (i.category !== category) continue;
    const hay = `${i.label} ${i.group}`.toLowerCase();
    if (!words.every((w) => hay.includes(w))) continue;
    groups.set(i.group, [...(groups.get(i.group) ?? []), i]);
  }
  return [...groups];
}

// The owner's own picture for this item: same category and name, not a sheet.
export function findLocal(pics: Picture[], i: LibItem): Picture | undefined {
  return pics.find((p) => !p.sheet && picturePath(p) === itemPath(i));
}

export const countByCategory = (items: LibItem[], c: string) => items.filter((i) => i.category === c).length;

export type LibError = "auth" | "limit" | "offline" | "missing" | "retry" | "nokey";
export const ERROR_TEXT: Record<LibError, string> = {
  nokey: "No GitHub key yet. Add it in Settings.",
  auth: "The GitHub key is not working. Check it in Settings.",
  limit: "GitHub says too many requests. Wait a few minutes and retry.",
  offline: "You are offline.",
  missing: "The art repo or the library list was not found.",
  retry: "GitHub could not be reached. Try again.",
};

export async function loadIndex(key: string): Promise<{ index: LibIndex; cached: boolean } | LibError> {
  const cached = await store.getSetting<LibIndex>("lib:index");
  if (!key) return cached ? { index: cached, cached: true } : "nokey";
  const r = await getFile(key, "items/library.json");
  if (r instanceof Uint8Array) {
    try {
      const v = JSON.parse(new TextDecoder().decode(r));
      if (isLibIndex(v)) {
        await store.setSetting("lib:index", v);
        return { index: v, cached: false };
      }
    } catch { /* falls through to the cached list */ }
    return cached ? { index: cached, cached: true } : "retry";
  }
  return cached ? { index: cached, cached: true } : r;
}

export const cachedThumb = (i: LibItem) => store.getSetting<Thumb>(`thumb:${itemPath(i)}`);

// A cached thumb is stale when the repo file has a different sha (or the cache has none); unknown shas count as fresh.
export const isStale = (cachedSha: string | undefined, sha: string | undefined): boolean => sha !== undefined && cachedSha !== sha;

// Downloads and decodes one item; the decoded pixels are cached for the next visit.
export async function fetchThumb(key: string, i: LibItem, sha?: string): Promise<Thumb | Exclude<GetResult, Uint8Array>> {
  const r = await getFile(key, itemPath(i));
  if (!(r instanceof Uint8Array)) return r;
  try {
    const t: Thumb = { ...(await decodePng(r)), sha };
    if (t.w > 256 || t.h > 256) return "retry";
    await store.setSetting(`thumb:${itemPath(i)}`, t);
    return t;
  } catch {
    return "retry";
  }
}

export function toPicture(i: LibItem, t: Thumb): Picture {
  const p = newPicture(safeName(i.category), stem(i), t.w, t.h);
  p.px = t.px.slice();
  return p;
}

// The library item a picture came from, if any.
export function itemOf(index: LibIndex | null, p: Picture): LibItem | undefined {
  return p.sheet ? undefined : index?.items.find((i) => itemPath(i) === picturePath(p));
}
