import { eoOperation } from "../fold/index.js";

export const EXPECTATION_STATES = Object.freeze(["open", "strengthened", "weakened", "fulfilled", "violated", "reframed", "superseded"]);

export function expectation({ id, hypothesis, giver, grounds = [], openedAt = null, scope = null, consequences = [], state = "open" }) {
  if (!id) throw new TypeError("Expectation requires id");
  if (!EXPECTATION_STATES.includes(state)) throw new TypeError(`unknown expectation state: ${state}`);
  return Object.freeze({ schema: "EOExpectation@1", id, hypothesis, giver, grounds: Object.freeze([...grounds]), openedAt, scope, consequences: Object.freeze([...consequences]), state });
}

/** State change is evaluation; a change of governing interpretive ground is REC. */
export function expectationTransition(current, state, { witness, consequence = null, grain = "Figure", reframes = null } = {}) {
  if (!EXPECTATION_STATES.includes(state)) throw new TypeError(`unknown expectation state: ${state}`);
  const op = state === "reframed" || reframes ? "REC" : "EVA";
  return eoOperation({
    op,
    grain,
    witness,
    inputs: [current.id],
    outputs: [current.id],
    consequence,
    payload: { action: "expectation", value: { ...current, state, ...(reframes ? { reframes } : {}) } },
  });
}
