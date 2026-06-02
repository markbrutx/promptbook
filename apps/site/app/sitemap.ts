import type { MetadataRoute } from "next";
import { DEMO_BOOKS } from "@/lib/demo/discover";
import { source } from "@/lib/source";

const DOCS_PAGES = [
  "introduction",
  "concepts",
  "fragments",
  "rules",
  "resolve-and-trace",
  "cli",
  "viewer",
  "examples",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const trim = base.endsWith("/") ? base.slice(0, -1) : base;
  const url = (path: string) => `${trim}${path}`;

  // Walk the Fumadocs source defensively: if a page is added but the manual
  // list above lags, the sitemap still includes it.
  const docsFromSource = source.getPages().map((p) => p.url);
  const docsUrls = new Set<string>([
    ...DOCS_PAGES.map((slug) => `/docs/${slug}`),
    ...docsFromSource,
    "/docs",
  ]);

  return [
    { url: url("/"), changeFrequency: "weekly", priority: 1.0 },
    { url: url("/demo"), changeFrequency: "weekly", priority: 0.9 },
    ...DEMO_BOOKS.map((entry) => ({
      url: url(`/demo/${entry.slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...[...docsUrls]
      .filter((u) => u.startsWith("/docs"))
      .sort()
      .map((u) => ({ url: url(u), changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
