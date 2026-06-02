import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const trim = base.endsWith("/") ? base.slice(0, -1) : base;
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${trim}/sitemap.xml`,
  };
}
