import { describe, expect, it } from "vitest";
import { hexToPx, hsvToHex, pxToHex } from "../src/colour";

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
