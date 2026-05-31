/** What the user is currently inspecting: a composition variant, a code-prompt sample, or a fragment. */
export type Selection =
  | { kind: "variant"; composition: string; variant: string }
  | { kind: "code"; name: string; sample: string }
  | { kind: "fragment"; id: string };
