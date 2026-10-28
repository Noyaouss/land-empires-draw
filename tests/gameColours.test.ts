import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GAME_COLOURS } from "../src/gameColours";

const GAME_PALETTE = "../game-claude/src/palette.ts";
const all = GAME_COLOURS.flatMap((g) => g.colours);

describe("GAME_COLOURS", () => {
  it("holds only #RRGGBB colours, each once", () => {
    for (const c of all) expect(c).toMatch(/^#[0-9A-F]{6}$/);
    expect(new Set(all).size).toBe(all.length);
  });

  it("groups by the game's ramps", () => {
    const names = GAME_COLOURS.map((g) => g.name);
    expect(names).toEqual(["Master", "Lush grass", "Dry grass", "Flowers", "Stone", "Ice", "Olive", "Sand", "Water", "Mudflat", "Marsh", "Leaf", "Other"]);
    expect(GAME_COLOURS.find((g) => g.name === "Leaf")!.colours).toEqual(["#1E4A17", "#2F7725", "#4A912C", "#69B134", "#9CC63F"]);
    expect(GAME_COLOURS[0].colours).toHaveLength(8);
  });

  // Only on the PC, where the game repo sits next to this one; CI has no game repo.
  it.runIf(existsSync(GAME_PALETTE))("matches every colour in the game's palette.ts", () => {
    const game = readFileSync(GAME_PALETTE, "utf8").match(/"#[0-9A-Fa-f]{6}"/g)!.map((s) => s.slice(1, -1).toUpperCase());
    expect([...all].sort()).toEqual([...new Set(game)].sort());
  });
});
