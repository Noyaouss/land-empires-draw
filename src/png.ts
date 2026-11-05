// Minimal PNG writer: 8-bit RGBA, filter 0 on every row. Pixels packed 0xRRGGBBAA.
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (const v of b) c = CRC[(c ^ v) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

async function deflate(b: Uint8Array): Promise<Uint8Array> {
  const s = new Blob([b as BlobPart]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

export async function encodePng(w: number, h: number, px: Uint32Array): Promise<Uint8Array> {
  const raw = new Uint8Array(h * (1 + w * 4));
  const dv = new DataView(raw.buffer);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) dv.setUint32(y * (1 + w * 4) + 1 + x * 4, px[y * w + x]);
  const ihdr = new Uint8Array(13);
  const hv = new DataView(ihdr.buffer);
  hv.setUint32(0, w);
  hv.setUint32(4, h);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", await deflate(raw)), chunk("IEND", new Uint8Array())];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

async function inflate(b: Uint8Array): Promise<Uint8Array> {
  const s = new Blob([b as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

// Reads 8-bit grey, grey+alpha, RGB, RGBA or palette PNGs, not interlaced. Anything else throws.
export async function decodePng(b: Uint8Array): Promise<{ w: number; h: number; px: Uint32Array }> {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b.length < 33 || dv.getUint32(0) !== 0x89504e47) throw new Error("not a PNG");
  let w = 0, h = 0, depth = 0, type = 0, interlace = 0;
  let pal: Uint8Array = new Uint8Array(0);
  let trns: Uint8Array = new Uint8Array(0);
  const idat: Uint8Array[] = [];
  for (let at = 8; at + 8 <= b.length;) {
    const len = dv.getUint32(at);
    const name = String.fromCharCode(...b.subarray(at + 4, at + 8));
    const data = b.subarray(at + 8, at + 8 + len);
    if (name === "IHDR") {
      w = dv.getUint32(at + 8);
      h = dv.getUint32(at + 12);
      [depth, type, , , interlace] = data.subarray(8, 13);
    } else if (name === "PLTE") pal = data;
    else if (name === "tRNS") trns = data;
    else if (name === "IDAT") idat.push(data);
    at += 12 + len;
  }
  if (depth !== 8 || interlace !== 0 || ![0, 2, 3, 4, 6].includes(type) || !w || !h) throw new Error("unsupported PNG");
  const bpp = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type as 0 | 2 | 3 | 4 | 6];
  const all = new Uint8Array(idat.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of idat) {
    all.set(p, o);
    o += p.length;
  }
  const raw = await inflate(all);
  const stride = w * bpp;
  if (raw.length < h * (stride + 1)) throw new Error("short PNG");
  const rows = new Uint8Array(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let i = 0; i < stride; i++) {
      const x = raw[y * (stride + 1) + 1 + i];
      const a = i >= bpp ? rows[y * stride + i - bpp] : 0;
      const up = y > 0 ? rows[(y - 1) * stride + i] : 0;
      const c = y > 0 && i >= bpp ? rows[(y - 1) * stride + i - bpp] : 0;
      const pa = Math.abs(up - c), pb = Math.abs(a - c), pc = Math.abs(a + up - 2 * c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? up : c;
      rows[y * stride + i] = (x + [0, a, up, (a + up) >> 1, paeth][f]) & 255;
    }
  }
  const px = new Uint32Array(w * h);
  const pack = (r: number, g: number, bl: number, al: number) => ((r << 24) | (g << 16) | (bl << 8) | al) >>> 0;
  for (let i = 0; i < w * h; i++) {
    const s = i * bpp;
    if (type === 6) px[i] = pack(rows[s], rows[s + 1], rows[s + 2], rows[s + 3]);
    else if (type === 2) px[i] = pack(rows[s], rows[s + 1], rows[s + 2], 255);
    else if (type === 0) px[i] = pack(rows[s], rows[s], rows[s], 255);
    else if (type === 4) px[i] = pack(rows[s], rows[s], rows[s], rows[s + 1]);
    else px[i] = pack(pal[rows[s] * 3], pal[rows[s] * 3 + 1], pal[rows[s] * 3 + 2], trns[rows[s]] ?? 255);
  }
  return { w, h, px };
}
