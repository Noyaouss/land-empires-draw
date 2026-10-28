// Draws the picture on the screen canvas: zoom, pan, checkerboard, grid, cell lines, shadow preview.
import type { Picture } from "../picture";
import { PREVIEW_GROUND, PREVIEW_SHADOW, shadowMask } from "../shadow";

export class View {
  zoom = 8;
  ox = 0;
  oy = 0;
  showShadow = false;
  private ctx: CanvasRenderingContext2D;
  private art = document.createElement("canvas");

  constructor(readonly canvas: HTMLCanvasElement, public pic: Picture) {
    this.ctx = canvas.getContext("2d")!;
  }

  resize(): void {
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(r.width * devicePixelRatio);
    this.canvas.height = Math.round(r.height * devicePixelRatio);
    this.draw();
  }

  // Whole picture on screen, centred, with room for the shadow.
  fit(): void {
    const r = this.canvas.getBoundingClientRect();
    this.zoom = Math.max(1, Math.floor(Math.min((r.width - 40) / (this.pic.w + 8), (r.height - 40) / (this.pic.h + 8))));
    this.ox = (r.width - this.pic.w * this.zoom) / 2;
    this.oy = (r.height - this.pic.h * this.zoom) / 2;
    this.draw();
  }

  toPixel(clientX: number, clientY: number): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    return [Math.floor((clientX - r.left - this.ox) / this.zoom), Math.floor((clientY - r.top - this.oy) / this.zoom)];
  }

  // Zoom around a screen point, so the pixel under the fingers stays put.
  zoomAt(clientX: number, clientY: number, zoom: number): void {
    const r = this.canvas.getBoundingClientRect();
    const z = Math.min(64, Math.max(1, zoom));
    const sx = clientX - r.left;
    const sy = clientY - r.top;
    this.ox = sx - ((sx - this.ox) * z) / this.zoom;
    this.oy = sy - ((sy - this.oy) * z) / this.zoom;
    this.zoom = z;
  }

  draw(): void {
    const { ctx, pic } = this;
    const z = this.zoom * devicePixelRatio;
    const ox = this.ox * devicePixelRatio;
    const oy = this.oy * devicePixelRatio;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#2a2a2e";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.imageSmoothingEnabled = false;
    if (this.showShadow) {
      const m = shadowMask(pic);
      ctx.fillStyle = PREVIEW_GROUND;
      ctx.fillRect(ox, oy, m.w * z, m.h * z);
      ctx.fillStyle = PREVIEW_SHADOW;
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.mask[y * m.w + x]) ctx.fillRect(ox + x * z, oy + y * z, z, z);
    } else {
      for (let y = 0; y < pic.h; y++) for (let x = 0; x < pic.w; x++) {
        ctx.fillStyle = (x + y) % 2 ? "#c8c8cc" : "#e8e8ec";
        ctx.fillRect(ox + x * z, oy + y * z, z, z);
      }
    }
    this.art.width = pic.w;
    this.art.height = pic.h;
    const img = new ImageData(pic.w, pic.h);
    const dv = new DataView(img.data.buffer);
    for (let i = 0; i < pic.px.length; i++) dv.setUint32(i * 4, pic.px[i]);
    this.art.getContext("2d")!.putImageData(img, 0, 0);
    ctx.drawImage(this.art, ox, oy, pic.w * z, pic.h * z);
    this.grid(ox, oy, z);
  }

  private grid(ox: number, oy: number, z: number): void {
    const { ctx, pic } = this;
    ctx.lineWidth = 1;
    for (const [step, colour] of [[1, "rgba(0,0,0,0.12)"], [16, "rgba(0,0,0,0.45)"]] as const) {
      if (step === 1 && this.zoom < 6) continue;
      ctx.strokeStyle = colour;
      ctx.beginPath();
      for (let x = 0; x <= pic.w; x += step) {
        ctx.moveTo(Math.round(ox + x * z) + 0.5, oy);
        ctx.lineTo(Math.round(ox + x * z) + 0.5, oy + pic.h * z);
      }
      for (let y = 0; y <= pic.h; y += step) {
        ctx.moveTo(ox, Math.round(oy + y * z) + 0.5);
        ctx.lineTo(ox + pic.w * z, Math.round(oy + y * z) + 0.5);
      }
      ctx.stroke();
    }
  }
}
