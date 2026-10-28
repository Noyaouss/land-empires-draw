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
