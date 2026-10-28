import { describe, expect, it } from "vitest";
import { History } from "../src/history";

describe("History", () => {
  it("undoes at least 100 strokes", () => {
    const h = new History();
    let cur: Uint32Array = new Uint32Array(4);
    for (let i = 1; i <= 150; i++) {
      h.push(cur);
      cur = cur.slice();
      cur[0] = i;
    }
    for (let i = 0; i < 100; i++) {
      const back = h.undo(cur);
      expect(back).not.toBeNull();
      cur = back!;
    }
    expect(cur[0]).toBe(50);
  });

  it("redoes an undo, and a new stroke clears redo", () => {
    const h = new History();
    const a = new Uint32Array([1]);
    const b = new Uint32Array([2]);
    h.push(a);
    const back = h.undo(b)!;
    expect(back[0]).toBe(1);
    expect(h.redo(back)![0]).toBe(2);
    h.undo(b);
    h.push(a);
    expect(h.redo(a)).toBeNull();
  });

  it("returns null when there is nothing to undo", () => {
    expect(new History().undo(new Uint32Array(1))).toBeNull();
  });
});
