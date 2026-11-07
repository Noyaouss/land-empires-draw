// Sends waiting pictures to the art repo. Runs on start, after each Save and when the tablet comes back online.
import { isCategories } from "./categories";
import { fetchCategories, getFile, putFile } from "./github";
import { isLibIndex, itemPath, type LibIndex } from "./library";
import { type Picture, picturePath } from "./picture";
import { encodePng } from "./png";
import * as store from "./store";

export type QueueResult = { sent: number; waiting: number; keyBad: boolean };

export async function runQueue(key: string): Promise<QueueResult> {
  let sent = 0;
  let keyBad = false;
  const done: Picture[] = [];
  for (const id of await store.listQueue()) {
    const p = await store.getPicture(id);
    if (!p) {
      await store.dequeue(id);
      continue;
    }
    let r: "ok" | "auth" | "retry" = "retry";
    try {
      const png = await encodePng(p.w, p.h, p.px);
      r = await putFile(key, picturePath(p), png, `art: ${picturePath(p).slice(6, -4)}`);
    } catch {
      r = "retry";
    }
    if (r === "auth") {
      keyBad = true;
      break;
    }
    if (r === "retry") continue;
    // Saved again while it was uploading: keep it waiting so the newer version goes too.
    if (!(await store.markSent(id, p.updated))) continue;
    await store.dequeue(id);
    sent++;
    if (!p.sheet) done.push(p);
  }
  if (done.length) await addToLibrary(key, done);
  return { sent, waiting: (await store.listQueue()).length, keyBad };
}

export async function refreshCategories(key: string): Promise<boolean> {
  const c = await fetchCategories(key);
  if (!isCategories(c)) return false;
  await store.cacheCategories(c);
  return true;
}

// One sync at a time; a request during a run makes it run once more afterwards, so nothing waits for the next trigger.
export class Syncer {
  private running: Promise<void> | null = null;
  private again = false;

  constructor(private run: () => Promise<void>) {}

  request(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      try {
        do {
          this.again = false;
          await this.run();
        } while (this.again);
      } finally {
        this.running = null;
      }
    })();
    return this.running;
  }

  idle(): Promise<void> {
    return this.running ?? Promise.resolve();
  }
}

// Sent pictures that the game library does not list yet (or lists with another size) go into items/library.json.
async function addToLibrary(key: string, pics: Picture[]): Promise<void> {
  try {
    const r = await getFile(key, "items/library.json");
    if (!(r instanceof Uint8Array)) return;
    const index = JSON.parse(new TextDecoder().decode(r)) as LibIndex;
    if (!isLibIndex(index)) return;
    let changed = false;
    for (const p of pics) {
      const file = picturePath(p).replace(/^items\/[^/]+\//, "").replace(/\.png$/, "");
      const e = index.items.find((i) => itemPath(i) === picturePath(p));
      if (!e) index.items.push({ category: p.category, file, group: file, label: file, w: p.w, h: p.h });
      else if (e.w !== p.w || e.h !== p.h) Object.assign(e, { w: p.w, h: p.h });
      else continue;
      changed = true;
    }
    if (changed) await putFile(key, "items/library.json", new TextEncoder().encode(JSON.stringify(index, null, 1) + "\n"), "art: library index");
  } catch { /* the pictures are safe; the list updates on the next save */ }
}
