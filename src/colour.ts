// Colours on screen are "#RRGGBB"; picture pixels are packed 0xRRGGBBAA (0 = see-through).
export function hexToPx(hex: string): number {
  return ((parseInt(hex.slice(1, 7), 16) << 8) | 0xff) >>> 0;
}

export function pxToHex(px: number): string {
  return `#${(px >>> 8).toString(16).padStart(6, "0").toUpperCase()}`;
}

// h in degrees, s and v from 0 to 1.
export function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
  };
  return `#${[f(5), f(3), f(1)].map((c) => c.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

// "#RRGGBB" to hue (degrees), saturation and value (0 to 1), so the colour wheel can open on the current colour.
export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const v = Math.max(r, g, b);
  const d = v - Math.min(r, g, b);
  const s = v === 0 ? 0 : d / v;
  if (d === 0) return { h: 0, s, v };
  const h = v === r ? ((g - b) / d + 6) % 6 : v === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, v };
}
