// Sends waiting pictures to the art repo. Runs on start, after each Save and when the tablet comes back online.
import { isCategories } from "./categories";
import { fetchCategories, putFile } from "./github";
import { picturePath } from "./picture";
import { encodePng } from "./png";
import * as store from "./store";

export type QueueResult = { sent: number; waiting: number; keyBad: boolean };

export async function runQueue(key: string): Promise<QueueResult> {
  let sent = 0;
  let keyBad = false;
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
  }
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
