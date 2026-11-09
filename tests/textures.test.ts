import { describe, expect, it } from "vitest";
import { TEXTURES, withSheet, withTextures } from "../src/categories";
import { newPicture } from "../src/picture";
import { repeatPreview } from "../src/textures";

describe("texture canvases", () => {
  it("keeps textures available with older remote categories without duplicating them", () => {
    const remote = { categories: [{ id: "custom", name: "Custom", sizes: [{ name: "small", w: 8, h: 8 }] }] };
    const result = withTextures(remote);
    expect(result.categories.map(c => c.id)).toEqual(["custom", "textures"]);
    expect(remote.categories).toHaveLength(1);
    expect(withTextures(result).categories).toHaveLength(2);
    expect(TEXTURES.sizes.map(s => s.name)).toEqual(["Grass", "Sand", "Rock", "Snow", "Forest floor"]);
    expect(TEXTURES.sizes.every(s => s.w === 64 && s.h === 64)).toBe(true);
    expect(withSheet(TEXTURES)).toEqual(TEXTURES.sizes);
  });

  it("repeats every pixel including transparency across all nine tiles without changing the drawing", () => {
    const p = newPicture("textures", "grass", 2, 2);
    p.px.set([0xff0000ff, 0, 0x00ff00ff, 0x0000ffff]);
    const preview = repeatPreview(p);
    expect([preview.w, preview.h]).toEqual([6, 6]);
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
      expect(preview.px[y * 6 + x]).toBe(p.px[(y % 2) * 2 + x % 2]);
    }
    preview.px[0] = 0;
    expect(p.px[0]).toBe(0xff0000ff);
    expect([p.w, p.h]).toEqual([2, 2]);
  });
});
