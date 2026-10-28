import { describe, expect, it } from "vitest";
import { penOnlyDecision } from "../src/ui/input";

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
