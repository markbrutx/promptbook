import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoIsland } from "@/components/demo-island";
import { DEMO_BOOKS, findDemoBook } from "@/lib/demo/discover";

interface PageProps {
  params: Promise<{ book: string }>;
}

export const dynamic = "force-static";
export const revalidate = false;

export function generateStaticParams() {
  return DEMO_BOOKS.map((entry) => ({ book: entry.slug }));
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { book } = await props.params;
  const entry = findDemoBook(book);
  if (entry === undefined) return {};
  return {
    title: `${entry.title} · demo`,
    description: entry.description,
  };
}

// Demo pages are full-bleed: no site header, no footer, no breadcrumb. A
// one-line framing strip on top tells a first-time visitor what this page is;
// the viewer owns the rest of the viewport. The strip is static JSX, so the
// page stays fully prerendered.
export default async function DemoBookPage(props: PageProps) {
  const { book } = await props.params;
  const entry = findDemoBook(book);
  if (entry === undefined) notFound();

  return (
    <div className="flex flex-col" style={{ height: "100dvh", minHeight: "600px", background: "var(--ink)" }}>
      <header
        className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b px-4 py-2 font-mono text-[11px]"
        style={{ borderColor: "var(--border)", color: "var(--muted)", background: "var(--ink)" }}
      >
        <Link
          href="/"
          className="whitespace-nowrap uppercase tracking-[0.28em] transition hover:opacity-70"
          style={{ color: "var(--text)" }}
        >
          ← back
        </Link>
        <p className="m-0 min-w-0 flex-1 truncate">
          A real prompt book running in your browser — no server, no model calls.
        </p>
        <Link
          href="/docs"
          className="whitespace-nowrap uppercase tracking-[0.28em] transition hover:opacity-70"
          style={{ color: "var(--text)" }}
        >
          how it works →
        </Link>
      </header>
      <DemoIsland slug={entry.slug} bookJsonUrl={entry.bookJsonUrl} />
    </div>
  );
}
