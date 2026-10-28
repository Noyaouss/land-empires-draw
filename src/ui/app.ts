// The drawing app: layout B (top bar, big canvas, palette strip with a pop-up colour wheel) and its panels.
import type { Categories } from "../categories";
import { hexToPx, pxToHex } from "../colour";
import { GAME_COLOURS } from "../gameColours";
import { History } from "../history";
import { fill, line, newPicture, pick, type Picture, safeName } from "../picture";
import * as store from "../store";
import type { Style } from "../store";
import { refreshCategories, runQueue, Syncer } from "../sync";
import { type PenState, penOnlyDecision, pointerRole, type Role } from "./input";
import { View } from "./view";
import { Wheel } from "./wheel";

type Tool = "pen" | "eraser" | "fill" | "picker";
const GAME_STYLE: Style = { id: "game", name: "Game colours", groups: GAME_COLOURS, builtIn: true };

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: (Node | string)[]) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) k === "class" ? (e.className = v) : e.setAttribute(k, v);
  e.append(...kids);
  return e;
};

export class App {
  private pic: Picture = newPicture("trees", "untitled", 32, 48);
  private history = new History();
  private tool: Tool = "pen";
  private colour = "#4A912C";
  private styles: Style[] = [GAME_STYLE];
  private style: Style = GAME_STYLE;
  private categories: Categories = { categories: [] };
  private key = "";
  private pen: PenState = { penOnly: false, penSeen: false };
  private waiting = 0;
  private keyBad = false;
  private view!: View;
  private wheel!: Wheel;
  private top = el("div", { id: "top" });
  private strip = el("div", { id: "strip" });
  private panel = el("div", { id: "panel", class: "hidden" });
  private toastEl = el("div", { id: "toast", class: "hidden" });
  private canvas = el("canvas", { id: "stage" });

  async start(root: HTMLElement): Promise<void> {
    root.append(this.top, this.canvas, this.strip, this.panel, this.toastEl);
    this.view = new View(this.canvas, this.pic);
    this.wheel = new Wheel((hex) => this.setColour(hex));
    void store.askPersist();
    this.key = (await store.getSetting<string>("key")) ?? "";
    this.pen = (await store.getSetting<PenState>("pen")) ?? this.pen;
    await store.saveStyle(GAME_STYLE); // always the game's current colours
    this.styles = await store.listStyles();
    const styleId = await store.getSetting<string>("style");
    this.style = this.styles.find((s) => s.id === styleId) ?? GAME_STYLE;
    this.categories = await store.getCategories();
    const last = await store.getSetting<string>("open");
    const pic = last ? await store.getPicture(last) : undefined;
    this.waiting = (await store.listQueue()).length;
    addEventListener("resize", () => this.view.resize());
    addEventListener("online", () => void this.sync());
    // Failed uploads are retried every minute while pictures wait, and when the app comes back to the front.
    setInterval(() => this.waiting && !this.keyBad && navigator.onLine && void this.sync(), 60_000);
    document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && void this.sync());
    this.input();
    this.view.resize();
    if (pic) this.open(pic);
    else this.newPanel();
    this.renderTop();
    this.renderStrip();
    if (!this.key) this.settingsPanel();
    void this.sync();
  }

  // ---------- drawing ----------
  private open(p: Picture): void {
    this.pic = p;
    this.view.pic = p;
    this.history = new History();
    void store.setSetting("open", p.id);
    this.view.fit();
    this.renderTop();
  }

  private input(): void {
    // Pointers in use and what each one does; ignored pointers (a palm under the pen, a third finger) are not kept.
    const pointers = new Map<number, { e: PointerEvent; role: Role }>();
    let stroke: { before: Uint32Array; last: [number, number]; id: number } | null = null;
    let gesture: { dist: number; zoom: number; mx: number; my: number; ox: number; oy: number } | null = null;
    let pan: { x: number; y: number; ox: number; oy: number; id: number } | null = null;
    const c = this.canvas;
    const fingers = () => [...pointers.values()].filter((p) => p.e.pointerType === "touch").map((p) => p.e);
    const mid = () => {
      const [a, b] = fingers();
      return { dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), mx: (a.clientX + b.clientX) / 2, my: (a.clientY + b.clientY) / 2 };
    };
    c.addEventListener("pointerdown", (e) => {
      const d = penOnlyDecision(this.pen, e.pointerType);
      if (d.state !== this.pen) {
        this.pen = d.state;
        void store.setSetting("pen", this.pen);
        this.toast("Pen found: only the pen draws now (change it in Settings)");
      }
      const active = { pen: [...pointers.values()].some((p) => p.e.pointerType === "pen"), touches: fingers().length };
      const role = pointerRole(this.pen, e.pointerType, active);
      if (role === "ignore") return;
      c.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { e, role });
      if (role === "pinch") {
        // A second finger means zoom and pan: cancel the stroke the first finger started.
        if (stroke) {
          this.pic.px.set(stroke.before);
          stroke = null;
        }
        pan = null;
        gesture = { ...mid(), zoom: this.view.zoom, ox: this.view.ox, oy: this.view.oy };
        this.view.draw();
        return;
      }
      if (role === "pan") {
        pan = { x: e.clientX, y: e.clientY, ox: this.view.ox, oy: this.view.oy, id: e.pointerId };
        return;
      }
      const [x, y] = this.view.toPixel(e.clientX, e.clientY);
      if (this.tool === "picker") {
        const px = pick(this.pic, x, y);
        if (px) this.setColour(pxToHex(px));
        return;
      }
      const before = this.pic.px.slice();
      if (this.tool === "fill") {
        fill(this.pic, x, y, hexToPx(this.colour));
        this.endStroke(before);
        return;
      }
      stroke = { before, last: [x, y], id: e.pointerId };
      line(this.pic, x, y, x, y, this.ink());
      this.view.draw();
    });
    c.addEventListener("pointermove", (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      p.e = e;
      if (gesture && p.e.pointerType === "touch") {
        if (fingers().length < 2) return;
        const m = mid();
        this.view.ox = gesture.ox + m.mx - gesture.mx;
        this.view.oy = gesture.oy + m.my - gesture.my;
        this.view.zoomAt(m.mx, m.my, Math.round(gesture.zoom * (m.dist / Math.max(1, gesture.dist))));
        this.view.draw();
        return;
      }
      if (pan && pan.id === e.pointerId) {
        this.view.ox = pan.ox + e.clientX - pan.x;
        this.view.oy = pan.oy + e.clientY - pan.y;
        this.view.draw();
        return;
      }
      if (!stroke || stroke.id !== e.pointerId) return;
      // Coalesced events: every pen sample, so fast strokes keep their shape.
      for (const ev of e.getCoalescedEvents?.() ?? [e]) {
        const [x, y] = this.view.toPixel(ev.clientX, ev.clientY);
        line(this.pic, stroke.last[0], stroke.last[1], x, y, this.ink());
        stroke.last = [x, y];
      }
      this.view.draw();
    });
    const up = (e: PointerEvent) => {
      if (!pointers.delete(e.pointerId)) return;
      if (fingers().length < 2) gesture = null;
      if (pan?.id === e.pointerId) pan = null;
      if (stroke && stroke.id === e.pointerId) {
        this.endStroke(stroke.before);
        stroke = null;
      }
    };
    c.addEventListener("pointerup", up);
    c.addEventListener("pointercancel", up);
    c.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.view.zoomAt(e.clientX, e.clientY, this.view.zoom + (e.deltaY < 0 ? 1 : -1));
      this.view.draw();
    }, { passive: false });
  }

  private ink(): number {
    return this.tool === "eraser" ? 0 : hexToPx(this.colour);
  }

  // Every finished stroke is kept on the tablet straight away, so nothing is lost if the app closes.
  private endStroke(before: Uint32Array): void {
    this.view.draw();
    if (before.every((v, i) => v === this.pic.px[i])) return;
    this.history.push(before);
    this.pic.updated = Date.now();
    void store.savePicture(this.pic);
  }

  private undoRedo(redo: boolean): void {
    const px = redo ? this.history.redo(this.pic.px) : this.history.undo(this.pic.px);
    if (!px) return;
    this.pic.px = px;
    this.pic.updated = Date.now();
    void store.savePicture(this.pic);
    this.view.draw();
  }

  private setColour(hex: string): void {
    this.colour = hex;
    if (this.tool === "eraser" || this.tool === "picker") this.tool = "pen";
    this.renderTop();
    this.renderStrip();
  }

  // ---------- saving ----------
  private async save(): Promise<void> {
    if (this.pic.sent && !confirm(`"${this.pic.name}" is already on GitHub. Replace it with this version?`)) return;
    this.pic.updated = Date.now();
    this.pic.sent = false;
    await store.savePicture(this.pic);
    await store.queueUpload(this.pic.id);
    this.waiting = (await store.listQueue()).length;
    this.renderTop();
    if (!this.key) this.toast("Saved on the tablet. Add your GitHub key in Settings to send it.");
    else if (!navigator.onLine) this.toast("Saved on the tablet. It will be sent when you are online.");
    await this.sync();
  }

  private syncer = new Syncer(() => this.syncOnce());

  private sync(): Promise<void> {
    return this.key ? this.syncer.request() : Promise.resolve();
  }

  private async syncOnce(): Promise<void> {
    try {
      if (await refreshCategories(this.key)) this.categories = await store.getCategories();
      const r = await runQueue(this.key);
      this.waiting = r.waiting;
      this.keyBad = r.keyBad;
      if (r.sent) this.toast(`Sent ${r.sent} picture${r.sent > 1 ? "s" : ""} to GitHub`);
      if (r.keyBad) this.toast("GitHub key not working. Check it in Settings.");
      const fresh = await store.getPicture(this.pic.id);
      if (fresh && fresh.updated === this.pic.updated) this.pic.sent = fresh.sent;
    } finally {
      this.renderTop();
    }
  }

  // ---------- top bar and strip ----------
  private renderTop(): void {
    const tool = (t: Tool, label: string) => {
      const b = el("button", { class: this.tool === t ? "on" : "" }, label);
      b.onclick = () => {
        this.tool = t;
        this.renderTop();
      };
      return b;
    };
    const btn = (label: string, f: () => void, cls = "") => {
      const b = el("button", { class: cls }, label);
      b.onclick = f;
      return b;
    };
    const shadow = btn("Shadow", () => {
      this.view.showShadow = !this.view.showShadow;
      this.view.draw();
      this.renderTop();
    }, this.view?.showShadow ? "on" : "");
    const styleSel = el("select", { "aria-label": "Style" });
    for (const s of this.styles) styleSel.append(el("option", { value: s.id, ...(s.id === this.style.id ? { selected: "" } : {}) }, s.name));
    styleSel.onchange = () => this.pickStyle(styleSel.value);
    const status = this.keyBad ? "Key not working" : this.waiting ? `${this.waiting} waiting` : "";
    this.top.replaceChildren(
      tool("pen", "✏️ Pen"), tool("eraser", "🧽 Eraser"), tool("fill", "🪣 Fill"), tool("picker", "💧 Pick"),
      btn("↶", () => this.undoRedo(false)), btn("↷", () => this.undoRedo(true)),
      shadow, el("span", { class: "sun", title: "Light comes from the upper left; shadows fall to the lower right" }, "☀ ↖"),
      el("span", { class: "name" }, `${this.pic.name} · ${this.pic.w}×${this.pic.h}`),
      el("span", { class: this.keyBad ? "status bad" : "status" }, status),
      styleSel, btn("Save", () => void this.save(), "save"), btn("☰", () => this.menuPanel()),
    );
  }

  private renderStrip(): void {
    const swatches: Node[] = [];
    for (const g of this.style.groups) {
      const grp = el("div", { class: "group", title: g.name });
      for (const c of g.colours) {
        const b = el("button", { class: c === this.colour ? "sw on" : "sw", style: `background:${c}`, "aria-label": c });
        b.onclick = () => this.setColour(c);
        grp.append(b);
      }
      swatches.push(grp);
    }
    const wheelBtn = el("button", { class: "sw rainbow", "aria-label": "Colour wheel" });
    wheelBtn.onclick = () => this.wheelPanel();
    const scroll = this.strip.scrollLeft; // keep the strip where the owner left it
    this.strip.replaceChildren(el("div", { class: "current", style: `background:${this.colour}` }), ...swatches, wheelBtn);
    this.strip.scrollLeft = scroll;
  }

  private async pickStyle(id: string): Promise<void> {
    this.style = this.styles.find((s) => s.id === id) ?? GAME_STYLE;
    await store.setSetting("style", this.style.id);
    this.renderTop();
    this.renderStrip();
  }

  // ---------- panels ----------
  private show(title: string, ...body: Node[]): void {
    const close = el("button", { class: "close" }, "✕");
    close.onclick = () => this.hide();
    this.panel.replaceChildren(el("div", { class: "box" }, el("div", { class: "head" }, el("h2", {}, title), close), ...body));
    this.panel.classList.remove("hidden");
  }

  private hide(): void {
    this.panel.classList.add("hidden");
  }

  private toastTimer = 0;

  private toast(msg: string): void {
    this.toastEl.textContent = msg;
    this.toastEl.classList.remove("hidden");
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.add("hidden"), 3500);
  }

  private menuPanel(): void {
    const item = (label: string, f: () => void) => {
      const b = el("button", { class: "wide" }, label);
      b.onclick = f;
      return b;
    };
    this.show("Menu",
      item("My pictures", () => void this.picturesPanel()),
      item("New picture", () => this.newPanel()),
      item("Styles", () => this.stylesPanel()),
      item("Settings", () => this.settingsPanel()));
  }

  private async picturesPanel(): Promise<void> {
    const pics = (await store.listPictures()).sort((a, b) => b.updated - a.updated);
    const queue = new Set(await store.listQueue());
    const body: Node[] = [];
    for (const cat of new Set(pics.map((p) => p.category))) {
      const grid = el("div", { class: "thumbs" });
      for (const p of pics.filter((x) => x.category === cat)) {
        const badge = p.sent ? "Sent" : queue.has(p.id) ? "Waiting" : "Not saved";
        const t = el("button", { class: "thumb" }, thumb(p), el("span", {}, p.name), el("span", { class: `badge ${badge.toLowerCase().replace(" ", "-")}` }, badge));
        t.onclick = () => {
          this.open(p);
          this.hide();
        };
        grid.append(t);
      }
      body.push(el("h3", {}, this.categories.categories.find((c) => c.id === cat)?.name ?? cat), grid);
    }
    this.show("My pictures", ...(body.length ? body : [el("p", {}, "No pictures yet.")]));
  }

  private newPanel(): void {
    let cat = this.categories.categories[0];
    let size = cat?.sizes[0];
    const name = el("input", { type: "text", placeholder: "Name, for example Big oak" });
    const cats = el("div", { class: "choices" });
    const sizes = el("div", { class: "choices" });
    const draw = () => {
      cats.replaceChildren(...this.categories.categories.map((c) => {
        const b = el("button", { class: c === cat ? "on" : "" }, c.name);
        b.onclick = () => {
          cat = c;
          size = c.sizes[0];
          draw();
        };
        return b;
      }));
      sizes.replaceChildren(...(cat?.sizes ?? []).map((s) => {
        const b = el("button", { class: s === size ? "on" : "" }, `${s.name} ${s.w}×${s.h}`);
        b.onclick = () => {
          size = s;
          draw();
        };
        return b;
      }));
    };
    draw();
    const create = el("button", { class: "save wide" }, "Create");
    create.onclick = async () => {
      if (!cat || !size) return;
      const n = name.value.trim() || "untitled";
      const same = (await store.listPictures()).find((p) => p.category === cat!.id && safeName(p.name) === safeName(n));
      if (same && !confirm(`A picture called "${same.name}" already exists in ${cat.name}. Replace it with a new blank one?`)) return;
      const p = newPicture(cat.id, n, size.w, size.h);
      if (same) p.id = same.id;
      await store.savePicture(p);
      this.open(p);
      this.hide();
    };
    this.show("New picture", el("h3", {}, "Category"), cats, el("h3", {}, "Size"), sizes, el("h3", {}, "Name"), name, create);
  }

  private wheelPanel(): void {
    const preview = el("div", { class: "current big", style: `background:${this.wheel.hex}` });
    const hex = el("span", {}, this.wheel.hex);
    const w = new Wheel((h) => {
      preview.style.background = h;
      hex.textContent = h;
    });
    Object.assign(w, { h: this.wheel.h, s: this.wheel.s, v: this.wheel.v });
    w.draw();
    const use = el("button", { class: "wide" }, "Use this colour");
    use.onclick = () => {
      Object.assign(this.wheel, { h: w.h, s: w.s, v: w.v });
      this.setColour(w.hex);
      this.hide();
    };
    const add = el("button", { class: "save wide" }, `Add to style`);
    add.onclick = async () => {
      if (this.style.builtIn) {
        if (!confirm("Game colours can't be changed. Make your own copy of it and add the colour there?")) return;
        await this.copyStyle(this.style, "My colours");
      }
      const mine = this.style.groups.find((g) => g.name === "Mine") ?? this.style.groups[this.style.groups.push({ name: "Mine", colours: [] }) - 1];
      if (!mine.colours.includes(w.hex)) mine.colours.push(w.hex);
      await store.saveStyle(this.style);
      Object.assign(this.wheel, { h: w.h, s: w.s, v: w.v });
      this.setColour(w.hex);
      this.hide();
    };
    this.show("Colour wheel", w.el, el("div", { class: "row" }, preview, hex), use, add);
  }

  private async copyStyle(from: Style, name: string): Promise<void> {
    const s: Style = { id: crypto.randomUUID(), name, groups: structuredClone(from.groups), builtIn: false };
    await store.saveStyle(s);
    this.styles = await store.listStyles();
    await this.pickStyle(s.id);
  }

  private stylesPanel(): void {
    const s = this.style;
    const btn = (label: string, f: () => void | Promise<void>, cls = "") => {
      const b = el("button", { class: cls }, label);
      b.onclick = () => void f();
      return b;
    };
    const again = () => this.stylesPanel();
    const actions = el("div", { class: "choices" },
      btn("New empty", async () => {
        const n = prompt("Name of the new style", "New style");
        if (!n) return;
        await this.copyStyle({ ...GAME_STYLE, groups: [{ name: "Mine", colours: [] }] }, n);
        again();
      }),
      btn("Duplicate", async () => {
        await this.copyStyle(s, `${s.name} copy`);
        again();
      }),
      ...(s.builtIn ? [] : [
        btn("Rename", async () => {
          const n = prompt("New name", s.name);
          if (!n) return;
          s.name = n;
          await store.saveStyle(s);
          this.renderTop();
          again();
        }),
        btn("Delete", async () => {
          if (!confirm(`Delete the style "${s.name}"? Your pictures are not affected.`)) return;
          await store.deleteStyle(s.id);
          this.styles = await store.listStyles();
          await this.pickStyle("game");
          again();
        }, "bad"),
      ]),
    );
    const list = el("div", {});
    for (const g of s.groups) {
      const row = el("div", { class: "group" });
      for (const c of g.colours) {
        const b = el("button", { class: "sw", style: `background:${c}`, "aria-label": `Remove ${c}` }, s.builtIn ? "" : "✕");
        if (!s.builtIn) b.onclick = async () => {
          g.colours = g.colours.filter((x) => x !== c);
          await store.saveStyle(s);
          this.renderStrip();
          again();
        };
        row.append(b);
      }
      list.append(el("h3", {}, g.name), row);
    }
    const note = s.builtIn ? "Game colours come from the game and can't be changed. Duplicate it to make your own." : "Tap a colour to remove it. Add colours from the colour wheel.";
    this.show(`Style: ${s.name}`, el("p", {}, note), actions, list);
  }

  private settingsPanel(): void {
    const key = el("input", { type: "password", placeholder: "github_pat_...", autocomplete: "off" }) as HTMLInputElement;
    key.value = this.key;
    const result = el("p", {});
    const saveKey = el("button", { class: "save" }, "Save key and test");
    saveKey.onclick = async () => {
      this.key = key.value.trim();
      await store.setSetting("key", this.key);
      result.textContent = "Testing...";
      const ok = await refreshCategories(this.key);
      result.textContent = ok ? "Key works. Categories loaded." : navigator.onLine ? "Key not working. Check the steps below." : "Saved. It will be tested when you are online.";
      if (ok) {
        this.categories = await store.getCategories();
        this.keyBad = false;
      }
      void this.sync();
    };
    const penOnly = el("input", { type: "checkbox", id: "penonly", ...(this.pen.penOnly ? { checked: "" } : {}) }) as HTMLInputElement;
    penOnly.onchange = async () => {
      this.pen = { penOnly: penOnly.checked, penSeen: true };
      await store.setSetting("pen", this.pen);
    };
    const send = el("button", {}, "Send waiting pictures now");
    send.onclick = () => void this.sync();
    const guide = el("ol", {},
      el("li", {}, "On the tablet or PC, open github.com and sign in."),
      el("li", {}, "Tap your picture (top right), then Settings."),
      el("li", {}, "At the bottom of the left list: Developer settings, then Personal access tokens, then Fine-grained tokens."),
      el("li", {}, "Generate new token. Name: Land Empires Draw. Expiration: the longest offered."),
      el("li", {}, "Repository access: Only select repositories, then pick land-empires-art (only that one)."),
      el("li", {}, "Permissions: Repository permissions, Contents, set to Read and write."),
      el("li", {}, "Generate token, copy it, paste it in the box above, tap Save key and test."));
    this.show("Settings",
      el("h3", {}, "GitHub key"), el("p", {}, "Kept on this tablet only. It can only write to the land-empires-art repo."),
      key, saveKey, result,
      el("h3", {}, "Pen"), el("label", { for: "penonly" }, penOnly, " Only the pen draws (fingers only zoom and move)"),
      el("h3", {}, "Sending"), el("p", {}, `${this.waiting} picture(s) waiting.`), send,
      el("h3", {}, "How to make the key"), guide);
  }
}

function thumb(p: Picture): HTMLCanvasElement {
  const c = el("canvas", { class: "art" });
  c.width = p.w;
  c.height = p.h;
  const img = new ImageData(p.w, p.h);
  const dv = new DataView(img.data.buffer);
  for (let i = 0; i < p.px.length; i++) dv.setUint32(i * 4, p.px[i]);
  c.getContext("2d")!.putImageData(img, 0, 0);
  return c;
}
