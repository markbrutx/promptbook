import type { DemoBookEntry } from "./types";

/**
 * Catalog of demo books shipped on the site. Each entry's `slug` must match a
 * folder under `examples/`. Order here drives the order in the demo landing.
 *
 * `/demo` redirects to the first entry (the flagship). Adding a new example
 * book means: 1) drop a folder into `examples/`, 2) add an entry below.
 */
export const DEMO_BOOKS: ReadonlyArray<Omit<DemoBookEntry, "href" | "bookJsonUrl">> = [
  {
    slug: "sports-broadcast",
    title: "Sports broadcast",
    description:
      "Synthetic broadcaster across 10 compositions and six context axes; demonstrates the multi-model output cascade and the forbid-wins compliance cascade.",
  },
  {
    slug: "support-assistant",
    title: "Support assistant",
    description:
      "Minimal quickstart book: shared fragments across two compositions, with a model-axis swap from prose to JSON to XML output.",
  },
];

export function bookEntry(entry: Omit<DemoBookEntry, "href" | "bookJsonUrl">): DemoBookEntry {
  return {
    ...entry,
    href: `/demo/${entry.slug}`,
    bookJsonUrl: `/demo/${entry.slug}/book.json`,
  };
}

export function findDemoBook(slug: string): DemoBookEntry | undefined {
  const entry = DEMO_BOOKS.find((b) => b.slug === slug);
  return entry === undefined ? undefined : bookEntry(entry);
}
