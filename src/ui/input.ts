// Who may draw: the first pen touch turns pen-only on (palm touches then never paint); the owner can turn it off in settings.
export type PenState = { penOnly: boolean; penSeen: boolean };

export function penOnlyDecision(state: PenState, pointerType: string): { draw: boolean; state: PenState } {
  if (pointerType === "pen") return { draw: true, state: state.penSeen ? state : { penOnly: true, penSeen: true } };
  if (pointerType === "touch") return { draw: !state.penOnly, state };
  return { draw: true, state };
}
