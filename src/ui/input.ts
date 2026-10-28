// Who may draw: the first pen touch turns pen-only on (palm touches then never paint); the owner can turn it off in settings.
export type PenState = { penOnly: boolean; penSeen: boolean };

export function penOnlyDecision(state: PenState, pointerType: string): { draw: boolean; state: PenState } {
  if (pointerType === "pen") return { draw: true, state: state.penSeen ? state : { penOnly: true, penSeen: true } };
  if (pointerType === "touch") return { draw: !state.penOnly, state };
  return { draw: true, state };
}

export type Role = "draw" | "pan" | "pinch" | "ignore";

// What a new pointer does, given what is already on the screen. Only fingers pinch; a palm never stops the pen.
export function pointerRole(state: PenState, pointerType: string, active: { pen: boolean; touches: number }): Role {
  if (pointerType === "pen") return active.pen ? "ignore" : "draw";
  if (pointerType !== "touch") return "draw";
  if (active.pen || active.touches >= 2) return "ignore";
  if (active.touches === 1) return "pinch";
  return state.penOnly ? "pan" : "draw";
}
