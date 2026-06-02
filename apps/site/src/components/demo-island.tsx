"use client";

import "@markbrutx/promptbook-viewer/web/styles.css";

import type { PromptBook } from "@markbrutx/promptbook-core/edge";
import { mountWebApp } from "@markbrutx/promptbook-viewer/web";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClientApi } from "@/lib/demo/client-api";
import { findDemoBook } from "@/lib/demo/discover";
import { parseBookJson } from "@/lib/demo/parse";
import type { BookJson } from "@/lib/demo/types";

interface DemoIslandProps {
  slug: string;
  bookJsonUrl: string;
}

export function DemoIsland({ slug, bookJsonUrl }: DemoIslandProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    let unmount: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(bookJsonUrl);
        if (!res.ok) throw new Error(`${bookJsonUrl} → ${res.status}`);
        const json = (await res.json()) as BookJson;
        if (cancelled) return;

        const book: PromptBook = parseBookJson(json);
        const entry = findDemoBook(slug);
        if (entry === undefined) throw new Error(`unknown demo book "${slug}"`);

        const api = createClientApi(book, entry);
        const mounted = mountWebApp({ container, api });
        unmount = mounted.unmount;
      } catch (cause) {
        if (!cancelled) {
          setError((cause as Error).message);
        }
      }
    })();

    return () => {
      cancelled = true;
      // Defer the unmount so React can finish the current render frame first.
      // Calling `root.unmount()` synchronously from a cleanup while the demo's
      // React tree is mid-render (which happens under StrictMode's double-
      // invoke in dev, and under Fast Refresh) trips React 19's "Attempted to
      // synchronously unmount a root while React was already rendering" guard.
      const pendingUnmount = unmount;
      if (pendingUnmount !== null) {
        queueMicrotask(pendingUnmount);
      }
    };
  }, [slug, bookJsonUrl]);

  if (error !== null) {
    return (
      <div
        className="mx-auto w-full max-w-5xl px-6 py-12 font-mono text-[12px] uppercase tracking-[0.24em]"
        style={{ color: "var(--muted)" }}
      >
        Failed to load the demo book: {error}
      </div>
    );
  }

  // Full bleed viewer: no site header/footer wraps us, so the host owns the
  // whole viewport. A small floating back link is the only site chrome. We pin
  // colour/background here so the dark site cascade carries cleanly into the
  // viewer and the embedded CSS variables (.promptbook-viewer-host in
  // globals.css) re-skin the viewer to the same dark palette.
  return (
    <div className="relative" style={{ height: "100dvh", minHeight: "600px", background: "var(--ink)" }}>
      <Link
        href="/"
        aria-label="Back to promptbook home"
        className="absolute top-3 right-3 z-20 flex items-center gap-2 border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.28em] backdrop-blur transition"
        style={{
          color: "var(--muted)",
          background: "color-mix(in oklab, var(--ink) 78%, transparent)",
          borderColor: "var(--border)",
        }}
      >
        <span aria-hidden="true">←</span> back
      </Link>
      <div
        ref={containerRef}
        className="promptbook-viewer-host"
        style={{
          color: "var(--text)",
          background: "var(--ink)",
          colorScheme: "dark",
          height: "100%",
        }}
      />
    </div>
  );
}
