/** What the user is currently inspecting: a composition variant or a fragment. */
export type Selection =
  | { kind: "variant"; composition: string; variant: string }
  | { kind: "fragment"; id: string };
