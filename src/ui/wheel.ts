// Colour wheel: hue ring around a saturation (left to right) and brightness (top to bottom) square.
import { hsvToHex } from "../colour";

const SIZE = 260;
const RING = 28;

export class Wheel {
  h = 120;
  s = 0.6;
  v = 0.7;
  readonly el = document.createElement("canvas");
  private part: "ring" | "square" | null = null;

  constructor(private onChange: (hex: string) => void) {
    this.el.width = SIZE * devicePixelRatio;
    this.el.height = SIZE * devicePixelRatio;
    this.el.style.width = this.el.style.height = `${SIZE}px`;
    this.el.style.touchAction = "none";
    this.el.addEventListener("pointerdown", (e) => {
      this.el.setPointerCapture(e.pointerId);
      const [x, y] = this.local(e);
      const d = Math.hypot(x - SIZE / 2, y - SIZE / 2);
      this.part = d > SIZE / 2 - RING ? "ring" : "square";
      this.move(e);
    });
    this.el.addEventListener("pointermove", (e) => this.part && this.move(e));
    this.el.addEventListener("pointerup", () => (this.part = null));
    this.draw();
  }

  get hex(): string {
    return hsvToHex(this.h, this.s, this.v);
  }

  private local(e: PointerEvent): [number, number] {
    const r = this.el.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  private move(e: PointerEvent): void {
    const [x, y] = this.local(e);
    const c = SIZE / 2;
    if (this.part === "ring") this.h = ((Math.atan2(y - c, x - c) * 180) / Math.PI + 360) % 360;
    else {
      const half = (c - RING - 8) / Math.SQRT2;
      this.s = Math.min(1, Math.max(0, (x - (c - half)) / (2 * half)));
      this.v = Math.min(1, Math.max(0, 1 - (y - (c - half)) / (2 * half)));
    }
    this.draw();
    this.onChange(this.hex);
  }

  draw(): void {
    const ctx = this.el.getContext("2d")!;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);
    const c = SIZE / 2;
    for (let a = 0; a < 360; a++) {
      ctx.beginPath();
      ctx.strokeStyle = hsvToHex(a, 1, 1);
      ctx.lineWidth = RING;
      ctx.arc(c, c, c - RING / 2, ((a - 1) * Math.PI) / 180, ((a + 1) * Math.PI) / 180);
      ctx.stroke();
    }
    const half = (c - RING - 8) / Math.SQRT2;
    const steps = 32;
    const cell = (2 * half) / steps;
    for (let i = 0; i < steps; i++) for (let j = 0; j < steps; j++) {
      ctx.fillStyle = hsvToHex(this.h, i / (steps - 1), 1 - j / (steps - 1));
      ctx.fillRect(c - half + i * cell, c - half + j * cell, cell + 0.5, cell + 0.5);
    }
    ctx.lineWidth = 3;
    ctx.strokeStyle = this.v > 0.5 ? "#000" : "#fff";
    ctx.strokeRect(c - half + this.s * 2 * half - 6, c - half + (1 - this.v) * 2 * half - 6, 12, 12);
    const a = (this.h * Math.PI) / 180;
    ctx.strokeStyle = "#fff";
    ctx.beginPath();
    ctx.arc(c + Math.cos(a) * (c - RING / 2), c + Math.sin(a) * (c - RING / 2), 9, 0, Math.PI * 2);
    ctx.stroke();
  }
}
