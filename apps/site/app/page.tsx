import type { Metadata } from "next";
import Link from "next/link";
import { CopyCode } from "@/components/copy-code";

export const metadata: Metadata = {
  title: "promptbook · storybook for prompts",
};

export default function HomePage() {
  return (
    <div className="bg-grain flex min-h-dvh flex-col bg-[var(--ink)] text-[var(--text)]">
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto flex h-16 w-full max-w-[42rem] items-center justify-between gap-6 px-6">
          <Link
            href="/"
            aria-label="promptbook home"
            className="flex items-center gap-3 text-[var(--text)] transition hover:opacity-90"
          >
            {/* biome-ignore lint/performance/noImgElement: pixel-art mark renders cleaner with a raw <img> than next/image's srcset */}
            <img
              src="/promptbook-mini.png"
              alt="promptbook"
              width={45}
              height={36}
              className="block h-8 w-auto shrink-0 select-none"
              style={{ imageRendering: "pixelated", aspectRatio: "45 / 36" }}
            />
            <span
              className="font-display text-[17px] tracking-[-0.01em] text-[var(--text)]"
              style={{ fontStyle: "italic", fontVariationSettings: "'SOFT' 60, 'opsz' 24" }}
            >
              promptbook
            </span>
          </Link>
          <nav className="flex items-center gap-6 font-mono text-[10.5px] uppercase tracking-[0.28em] text-[var(--muted)]">
            <Link href="/docs" className="transition hover:text-[var(--text)]">
              Docs
            </Link>
            <Link href="/demo/sports-broadcast" className="transition hover:text-[var(--text)]">
              Demo
            </Link>
            <a
              href="https://github.com/markbrutx/promptbook"
              className="transition hover:text-[var(--text)]"
              rel="noopener noreferrer"
              target="_blank"
            >
              GitHub
              <span className="ml-1 text-[var(--accent)]">↗</span>
            </a>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 items-center">
        <div className="mx-auto w-full max-w-[42rem] px-6 py-20 md:py-28">
          <div className="flex flex-col gap-12">
            <h1
              className="font-display text-[4rem] leading-[0.95] font-medium tracking-[-0.022em] text-[var(--text)] sm:text-[5.2rem]"
              style={{ fontStyle: "italic", fontVariationSettings: "'SOFT' 100, 'opsz' 144" }}
            >
              promptbook<span className="text-[var(--accent)]">.</span>
            </h1>

            <p className="max-w-[40ch] text-[18px] leading-[1.55] text-[var(--muted)]">
              System prompts are part of your code too. I didn&rsquo;t like that they end up scattered all
              over the codebase, so I made{" "}
              <Link
                href="/demo"
                className="text-[var(--text)] underline decoration-[var(--border-strong)] underline-offset-4 transition hover:decoration-[var(--accent)] hover:text-[var(--accent)]"
              >
                Storybook for prompts
              </Link>
              . Called it promptbook.
            </p>

            <div className="flex flex-col gap-3">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-[var(--subtle)]">
                Feed the skill to your agent
              </span>
              <CopyCode code="npx skills add markbrutx/promptbook" size="lg" />
              <span className="font-mono text-[11px] leading-[1.5] text-[var(--muted)]">
                The skill lives on{" "}
                <a
                  href="https://github.com/markbrutx/promptbook"
                  rel="noopener noreferrer"
                  target="_blank"
                  className="text-[var(--text)] underline decoration-[var(--border-strong)] underline-offset-4 transition hover:decoration-[var(--accent)] hover:text-[var(--accent)]"
                >
                  GitHub
                </a>
                . Your agent reads it, then writes fragments and rules for you.
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2">
              <Link
                href="/demo/sports-broadcast"
                className="inline-flex items-center gap-2 border-b border-[var(--border-strong)] pb-1 font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                See the demo →
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 border-b border-[var(--border-strong)] pb-1 font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                Read the docs →
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto flex h-12 w-full max-w-[42rem] items-center justify-between px-6 font-mono text-[10px] uppercase tracking-[0.32em] text-[var(--subtle)]">
          <span>MIT &middot; open source</span>
          <Link href="/demo" className="transition hover:text-[var(--accent)]">
            storybook for prompts
          </Link>
        </div>
      </footer>
    </div>
  );
}
