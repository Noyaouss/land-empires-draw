import { describe, expect, it } from "vitest";
import { STARTER, withSheet } from "../src/categories";

describe("withSheet", () => {
  it("adds a sheet twice the biggest size, at most 128 px", () => {
    const trees = withSheet(STARTER.categories[0]);
    expect(trees.at(-1)).toEqual({ name: "sheet", w: 96, h: 128, sheet: true });
    const rocks = withSheet(STARTER.categories[1]);
    expect(rocks.at(-1)).toEqual({ name: "sheet", w: 64, h: 64, sheet: true });
    expect(trees.slice(0, -1)).toEqual(STARTER.categories[0].sizes);
  });
});
