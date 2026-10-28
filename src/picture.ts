// One item picture. Colours are packed 0xRRGGBBAA; 0 is see-through.
export type Picture = {
  id: string; name: string; category: string; w: number; h: number; px: Uint32Array; sent: boolean; updated: number; sheet?: boolean;
};

export function newPicture(category: string, name: string, w: number, h: number): Picture {
  return { id: crypto.randomUUID(), name, category, w, h, px: new Uint32Array(w * h), sent: false, updated: Date.now() };
}

export function pick(p: Picture, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= p.w || y >= p.h) return 0;
  return p.px[y * p.w + x];
}

export function setPx(p: Picture, x: number, y: number, c: number): void {
  if (x < 0 || y < 0 || x >= p.w || y >= p.h) return;
  p.px[y * p.w + x] = c;
}

// Bresenham, so a fast pen stroke leaves no gaps between samples.
export function line(p: Picture, x0: number, y0: number, x1: number, y1: number, c: number): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    setPx(p, x0, y0, c);
    if (x0 === x1 && y0 === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

// 4-way flood fill.
export function fill(p: Picture, x: number, y: number, c: number): void {
  if (x < 0 || y < 0 || x >= p.w || y >= p.h) return;
  const from = pick(p, x, y);
  if (from === c) return;
  const stack = [y * p.w + x];
  while (stack.length > 0) {
    const i = stack.pop()!;
    if (p.px[i] !== from) continue;
    p.px[i] = c;
    const px = i % p.w;
    if (px > 0) stack.push(i - 1);
    if (px < p.w - 1) stack.push(i + 1);
    if (i >= p.w) stack.push(i - p.w);
    if (i < p.px.length - p.w) stack.push(i + p.w);
  }
}

// File name part: lower case a-z, 0-9 and dashes only, so no path can escape its folder.
export function safeName(s: string): string {
  const out = s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return out || "untitled";
}

// Where the picture goes in the art repo. Sheets (several items on one canvas) go to a sheets folder so the game knows to cut them apart.
export function picturePath(p: Picture): string {
  return `items/${safeName(p.category)}/${p.sheet ? "sheets/" : ""}${safeName(p.name)}.png`;
}
