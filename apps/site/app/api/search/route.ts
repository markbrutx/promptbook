import { createFromSource } from "fumadocs-core/search/server";
import { source } from "@/lib/source";

// Statically pre-render the search index: facts.md mandates that every route
// outside /demo/* is statically rendered. The viewer client uses
// `type: "static"` against /api/search to download this once on mount.
export const revalidate = false;
export const dynamic = "force-static";
export const { staticGET: GET } = createFromSource(source);
