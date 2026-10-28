import { describe, expect, it } from "vitest";
import { penOnlyDecision, pointerRole } from "../src/ui/input";

describe("penOnlyDecision", () => {
  it("lets fingers draw until a pen is seen", () => {
    const s = { penOnly: false, penSeen: false };
    expect(penOnlyDecision(s, "touch").draw).toBe(true);
  });

  it("turns pen-only on the first time the pen touches", () => {
    const r = penOnlyDecision({ penOnly: false, penSeen: false }, "pen");
    expect(r.draw).toBe(true);
    expect(r.state).toEqual({ penOnly: true, penSeen: true });
    expect(penOnlyDecision(r.state, "touch").draw).toBe(false);
  });

  it("keeps the owner's choice once they turn pen-only off", () => {
    const r = penOnlyDecision({ penOnly: false, penSeen: true }, "pen");
    expect(r.state.penOnly).toBe(false);
    expect(penOnlyDecision(r.state, "touch").draw).toBe(true);
  });

  it("always lets a mouse draw", () => {
    expect(penOnlyDecision({ penOnly: true, penSeen: true }, "mouse").draw).toBe(true);
  });
});

describe("pointerRole", () => {
  const penOnly = { penOnly: true, penSeen: true };
  const fingers = { penOnly: false, penSeen: false };
  it("lets the pen draw with a palm already on the screen", () => {
    expect(pointerRole(penOnly, "pen", { pen: false, touches: 1 })).toBe("draw");
  });
  it("ignores a palm while the pen draws", () => {
    expect(pointerRole(penOnly, "touch", { pen: true, touches: 0 })).toBe("ignore");
  });
  it("pans with one finger and pinches with two in pen-only mode", () => {
    expect(pointerRole(penOnly, "touch", { pen: false, touches: 0 })).toBe("pan");
    expect(pointerRole(penOnly, "touch", { pen: false, touches: 1 })).toBe("pinch");
  });
  it("draws with one finger and pinches with two when fingers may draw", () => {
    expect(pointerRole(fingers, "touch", { pen: false, touches: 0 })).toBe("draw");
    expect(pointerRole(fingers, "touch", { pen: false, touches: 1 })).toBe("pinch");
  });
  it("ignores a third finger", () => {
    expect(pointerRole(fingers, "touch", { pen: false, touches: 2 })).toBe("ignore");
  });
});
