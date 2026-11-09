import type { Picture } from "./picture";

// A separate read-only image: saving still uses the original single tile.
export function repeatPreview(p: Picture): Picture {
  const w = p.w * 3, h = p.h * 3;
  const px = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    px[y * w + x] = p.px[(y % p.h) * p.w + x % p.w];
  }
  return { ...p, w, h, px };
}
