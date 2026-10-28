// Screen-only preview of the cast shadow the game will make: sun upper left (SUN.dx = dy = -1 in the game), shadow to the lower right.
import type { Picture } from "./picture";

export const PREVIEW_GROUND = "#66A84E"; // lush grass mid, game colour id 9
export const PREVIEW_SHADOW = "#4F9443"; // lush grass dark, one step darker, id 8

// Lighting council sizes: about 3 px for a 16 px rock, 7 px for a 48 px tree.
export function shadowLength(h: number): number {
  return Math.max(1, Math.round(3 + ((h - 16) * 4) / 32));
}

export function shadowMask(p: Picture): { w: number; h: number; mask: Uint8Array } {
  const len = shadowLength(p.h);
  const w = p.w + len;
  const h = p.h + len;
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    if (!p.px[y * p.w + x]) continue;
    for (let k = 1; k <= len; k++) mask[(y + k) * w + x + k] = 1;
  }
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.px[y * p.w + x]) mask[y * w + x] = 0;
  return { w, h, mask };
}
