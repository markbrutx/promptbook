// Plain-data shape of `serializeBookJson` output (packages/core/src/bundle.ts).
// Kept in sync by the round-trip unit test below: any drift in the canonical
// JSON shape breaks the test before it can break the demo.

export interface BookJsonFragment {
  id: string;
  kind?: string;
  tags?: string[];
  body: string;
  sourceFile: string;
}

export interface BookJsonRule {
  index: number;
  when: Record<string, string | number | boolean>;
  action: "add" | "replace" | "forbid" | "order";
  add?: string[];
  after?: string;
  replace?: Record<string, string>;
  forbid?: string[];
  order?: string[];
}

export interface BookJsonComposition {
  name: string;
  base: string[];
  order?: string[];
  rules: BookJsonRule[];
  sourceFile: string;
}

export interface BookJsonCodePromptSample {
  label: string;
  context?: Record<string, string | number | boolean>;
  output: string;
}

export interface BookJsonCodePrompt {
  name: string;
  description?: string;
  samples: BookJsonCodePromptSample[];
  sourceFile: string;
}

/** The serialized book shape emitted by `serializeBookJson`. */
export interface BookJson {
  fragments: BookJsonFragment[];
  compositions: BookJsonComposition[];
  codePrompts: BookJsonCodePrompt[];
  warnings: string[];
}

export interface DemoBookEntry {
  slug: string;
  /** Human title shown in the demo landing. Synthetic; never derived from fragments. */
  title: string;
  /** One-line description shown in the demo landing. */
  description: string;
  /** Path under `/demo/` where the book is mounted. */
  href: string;
  /** Path under `/demo/<slug>/book.json` (the resolver source). */
  bookJsonUrl: string;
}
