import { describe, expect, it } from "vitest";
import { hexToHsv, hexToPx, hsvToHex, pxToHex } from "../src/colour";

describe("colour", () => {
  it("packs #RRGGBB as opaque 0xRRGGBBAA and back", () => {
    expect(hexToPx("#66A84E")).toBe(0x66a84eff);
    expect(pxToHex(0x66a84eff)).toBe("#66A84E");
  });

  it("turns hue, saturation and value into a colour", () => {
    expect(hsvToHex(0, 1, 1)).toBe("#FF0000");
    expect(hsvToHex(120, 1, 1)).toBe("#00FF00");
    expect(hsvToHex(240, 1, 0.5)).toBe("#000080");
    expect(hsvToHex(0, 0, 1)).toBe("#FFFFFF");
    expect(hsvToHex(360, 1, 1)).toBe("#FF0000");
  });
});

describe("hexToHsv", () => {
  it("gives back the hue, saturation and value of a colour", () => {
    expect(hexToHsv("#FF0000")).toEqual({ h: 0, s: 1, v: 1 });
    expect(hexToHsv("#000080").h).toBe(240);
    expect(hexToHsv("#FFFFFF")).toEqual({ h: 0, s: 0, v: 1 });
  });

  it("round-trips every game leaf colour", () => {
    for (const c of ["#1E4A17", "#2F7725", "#4A912C", "#69B134", "#9CC63F", "#66A84E"]) {
      const { h, s, v } = hexToHsv(c);
      expect(hsvToHex(h, s, v)).toBe(c);
    }
  });
});
