import { describe, expect, it } from "vitest";
import { encodePng } from "../src/png";

async function inflate(b: Uint8Array): Promise<Uint8Array> {
  const s = new Blob([b as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

describe("encodePng", () => {
  it("writes a valid RGBA PNG with the same pixels", async () => {
    const px = new Uint32Array([0xff0000ff, 0x00000000, 0x11223344, 0xffffffff]);
    const png = await encodePng(2, 2, px);
    expect([...png.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const dv = new DataView(png.buffer, png.byteOffset);
    expect(new TextDecoder().decode(png.slice(12, 16))).toBe("IHDR");
    expect(dv.getUint32(16)).toBe(2);
    expect(dv.getUint32(20)).toBe(2);
    expect(png[24]).toBe(8);
    expect(png[25]).toBe(6);
    // IHDR CRC for 2x2 8-bit RGBA, known value
    expect(dv.getUint32(29)).toBe(0x72b60d24);
    const idatLen = dv.getUint32(33);
    expect(new TextDecoder().decode(png.slice(37, 41))).toBe("IDAT");
    const raw = await inflate(png.slice(41, 41 + idatLen));
    expect([...raw]).toEqual([0, 255, 0, 0, 255, 0, 0, 0, 0, 0, 0x11, 0x22, 0x33, 0x44, 255, 255, 255, 255]);
    expect(new TextDecoder().decode(png.slice(png.length - 8, png.length - 4))).toBe("IEND");
  });
});
