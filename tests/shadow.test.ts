import { describe, expect, it } from "vitest";
import { newPicture, setPx } from "../src/picture";
import { PREVIEW_GROUND, PREVIEW_SHADOW, shadowLength, shadowMask } from "../src/shadow";

describe("shadowLength", () => {
  it("matches the lighting council's rock and tree sizes", () => {
    expect(shadowLength(16)).toBe(3);
    expect(shadowLength(48)).toBe(7);
    expect(shadowLength(1)).toBeGreaterThanOrEqual(1);
  });
});

describe("shadowMask", () => {
  it("falls to the lower right, away from the upper-left sun", () => {
    const p = newPicture("rocks", "r", 16, 16);
    setPx(p, 0, 0, 0xff0000ff);
    const m = shadowMask(p);
    expect(m.w).toBe(19);
    expect(m.h).toBe(19);
    const on: string[] = [];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.mask[y * m.w + x]) on.push(`${x},${y}`);
    expect(on).toEqual(["1,1", "2,2", "3,3"]);
  });

  it("never covers the item's own pixels", () => {
    const p = newPicture("rocks", "r", 16, 16);
    for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) setPx(p, x, y, 0xff0000ff);
    const m = shadowMask(p);
    for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) expect(m.mask[y * m.w + x]).toBe(0);
    expect(m.mask[8 * m.w + 8]).toBe(1);
  });

  it("uses the game's grass and one step darker", () => {
    expect(PREVIEW_GROUND).toBe("#66A84E");
    expect(PREVIEW_SHADOW).toBe("#4F9443");
  });
});
