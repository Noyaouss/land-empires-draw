import { describe, expect, it } from "vitest";
import { fill, line, newPicture, pick, safeName, setPx } from "../src/picture";

const RED = 0xff0000ff;
const BLUE = 0x0000ffff;

describe("line", () => {
  it("covers every pixel between two pen samples, no gaps", () => {
    const p = newPicture("trees", "t", 16, 16);
    line(p, 0, 0, 9, 3, RED);
    const set: [number, number][] = [];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (pick(p, x, y) === RED) set.push([x, y]);
    expect(set).toHaveLength(10);
    const xs = set.map(([x]) => x).sort((a, b) => a - b);
    expect(xs).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (let i = 1; i < set.length; i++) {
      const [ax, ay] = set[i - 1];
      const [bx, by] = set[i];
      expect(Math.max(Math.abs(ax - bx), Math.abs(ay - by))).toBe(1);
    }
  });

  it("ignores points off the canvas", () => {
    const p = newPicture("trees", "t", 4, 4);
    line(p, -3, 1, 6, 1, RED);
    expect([0, 1, 2, 3].map((x) => pick(p, x, 1))).toEqual([RED, RED, RED, RED]);
    expect(pick(p, -1, 1)).toBe(0);
  });
});

describe("fill", () => {
  it("fills inside a ring only", () => {
    const p = newPicture("rocks", "r", 5, 5);
    for (let i = 0; i < 5; i++) {
      setPx(p, i, 0, RED);
      setPx(p, i, 4, RED);
      setPx(p, 0, i, RED);
      setPx(p, 4, i, RED);
    }
    fill(p, 2, 2, BLUE);
    expect(pick(p, 2, 2)).toBe(BLUE);
    expect(pick(p, 1, 3)).toBe(BLUE);
    expect(pick(p, 0, 0)).toBe(RED);
    const outside = newPicture("rocks", "r", 6, 6);
    setPx(outside, 2, 2, RED);
    fill(outside, 0, 0, BLUE);
    expect(pick(outside, 2, 2)).toBe(RED);
    expect(pick(outside, 5, 5)).toBe(BLUE);
  });

  it("does nothing when the colour is already the same", () => {
    const p = newPicture("rocks", "r", 3, 3);
    fill(p, 1, 1, 0);
    expect([...p.px].every((c) => c === 0)).toBe(true);
  });
});

describe("safeName", () => {
  it("makes a safe file name", () => {
    expect(safeName("Big Oak / é 2")).toBe("big-oak-e-2");
    expect(safeName("../../etc")).toBe("etc");
    expect(safeName("   ")).toBe("untitled");
    expect(safeName("..")).toBe("untitled");
  });
});

describe("newPicture", () => {
  it("starts see-through, not sent", () => {
    const p = newPicture("bushes", "Bush", 16, 16);
    expect(p.px).toHaveLength(256);
    expect(p.sent).toBe(false);
    expect(p.id).toBeTruthy();
  });
});
