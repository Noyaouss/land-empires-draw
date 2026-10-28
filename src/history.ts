// Undo and redo, one entry per stroke (a copy of the pixels before it).
export class History {
  private past: Uint32Array[] = [];
  private future: Uint32Array[] = [];

  constructor(private limit = 200) {}

  push(before: Uint32Array): void {
    this.past.push(before.slice());
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }

  undo(cur: Uint32Array): Uint32Array | null {
    const prev = this.past.pop();
    if (!prev) return null;
    this.future.push(cur.slice());
    return prev;
  }

  redo(cur: Uint32Array): Uint32Array | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(cur.slice());
    return next;
  }
}
