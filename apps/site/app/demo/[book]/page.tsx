import type { Metadata } from "next";
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

// Demo pages are full-bleed: no site header, no footer, no breadcrumb. The
// viewer owns the screen. A small floating "← back" link in the top-left
// corner is the only chrome.
export default async function DemoBookPage(props: PageProps) {
  const { book } = await props.params;
  const entry = findDemoBook(book);
  if (entry === undefined) notFound();

  return <DemoIsland slug={entry.slug} bookJsonUrl={entry.bookJsonUrl} />;
}
