import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { CopyCode } from "@/components/copy-code";
import { PromptGraph } from "@/components/prompt-graph";

export const metadata: Metadata = {
  title: { absolute: "promptbook · storybook for prompts" },
  description:
    "System prompts as a folder of small plain files you can see — browse every assembled variant, flip context, trace every decision. Deterministic resolve(), zero model calls in the engine.",
};

function PrimaryCta({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-6 py-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--ink)] transition hover:brightness-110 active:brightness-95"
    >
      {children}
    </Link>
  );
}

function GhostCta({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border-strong)] px-6 py-3.5 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
    >
      {children}
    </Link>
  );
}

function SectionHeading({ eyebrow, title, sub }: { eyebrow: string; title: ReactNode; sub?: string }) {
  return (
    <div className="flex flex-col gap-4">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-[var(--subtle)]">
        {eyebrow}
      </span>
      <h2
        className="font-display text-[2rem] leading-[1.08] font-medium tracking-[-0.015em] text-[var(--text)] sm:text-[2.6rem]"
        style={{ fontStyle: "italic", fontVariationSettings: "'SOFT' 80, 'opsz' 60" }}
      >
        {title}
      </h2>
      {sub !== undefined && (
        <p className="max-w-[58ch] text-[15.5px] leading-[1.6] text-[var(--muted)]">{sub}</p>
      )}
    </div>
  );
}

function FeatureCard({
  title,
  body,
  visual,
  className = "",
}: {
  title: string;
  body: string;
  visual: ReactNode;
  className?: string;
}) {
  return (
    <article className={`landing-card flex min-w-0 flex-col overflow-hidden p-6 sm:p-7 ${className}`}>
      <h3
        className="font-display text-[1.35rem] leading-tight font-medium tracking-[-0.01em] text-[var(--text)]"
        style={{ fontStyle: "italic", fontVariationSettings: "'SOFT' 70, 'opsz' 40" }}
      >
        {title}
      </h3>
      <p className="mt-2.5 max-w-[52ch] text-[14px] leading-[1.62] text-[var(--muted)]">{body}</p>
      <div className="mt-6 flex flex-1 flex-col">{visual}</div>
    </article>
  );
}

/* ---------- Card mini-visuals (all synthetic-fixture vocabulary) ---------- */

function UsedInVisual() {
  const comps: [string, number][] = [
    ["half-time-recap", 24],
    ["push-headline", 64],
    ["social-post", 104],
    ["ticker-overlay", 144],
  ];
  return (
    <div className="landing-pane flex h-full items-center justify-center overflow-hidden px-4 py-3">
      <svg
        viewBox="0 0 340 168"
        className="h-auto w-full max-w-[360px]"
        role="img"
        aria-label="One fragment shared by four compositions"
      >
        <title>persona is used by four compositions</title>
        {comps.map(([label, y]) => (
          <g key={label}>
            <line
              x1="78"
              y1="84"
              x2="216"
              y2={y}
              stroke="var(--border-strong)"
              strokeWidth="1"
              opacity="0.75"
            />
            <circle cx="216" cy={y} r="4.5" fill="var(--accent)" opacity="0.9" />
            <text x="228" y={y + 3} fill="var(--muted)" fontSize="10" fontFamily="var(--font-mono)">
              {label}
            </text>
          </g>
        ))}
        <circle cx="78" cy="84" r="14" fill="var(--accent)" opacity="0.14" />
        <circle cx="78" cy="84" r="6" fill="var(--text)" />
        <text
          x="78"
          y="112"
          fill="var(--text)"
          fontSize="10.5"
          fontFamily="var(--font-mono)"
          textAnchor="middle"
        >
          persona
        </text>
        <text
          x="78"
          y="126"
          fill="var(--subtle)"
          fontSize="9"
          fontFamily="var(--font-mono)"
          textAnchor="middle"
        >
          used in 10 / 10
        </text>
      </svg>
    </div>
  );
}

function ViewerVisual() {
  const chips = ["sport=tennis", "tier=vip", "platform=social", "model=claude"];
  const rows: { id: string; color: string; width: string; label: string }[] = [
    { id: "persona-1", color: "var(--accent)", width: "82%", label: "persona" },
    { id: "persona-2", color: "var(--accent)", width: "64%", label: "" },
    { id: "sport", color: "var(--accent-warm)", width: "71%", label: "sport-tennis" },
    { id: "tier-1", color: "var(--accent-rose)", width: "54%", label: "tier-vip" },
    { id: "tier-2", color: "var(--accent-rose)", width: "38%", label: "" },
    { id: "format", color: "var(--text)", width: "66%", label: "format-xml" },
  ];
  return (
    <div className="landing-pane flex h-full flex-col justify-center gap-4 px-4 py-4">
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <span
            key={chip}
            className="rounded-full border border-[var(--border)] px-2.5 py-1 font-mono text-[9.5px] tracking-[0.06em] text-[var(--muted)]"
          >
            {chip}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-2.5">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-2.5">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: row.color }} />
            <span
              className="h-[7px] rounded-full"
              style={{
                width: row.width,
                background: `color-mix(in oklab, ${row.color} 26%, var(--surface-2))`,
              }}
            />
            {row.label !== "" && (
              <span className="font-mono text-[9px] whitespace-nowrap text-[var(--subtle)]">{row.label}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TraceVisual() {
  return (
    <div className="landing-pane h-full overflow-x-auto px-4 py-4 font-mono text-[10.5px] leading-[1.9] whitespace-nowrap">
      <div>
        <span className="text-[var(--accent)]">✓</span> <span className="text-[var(--muted)]">when</span>{" "}
        <span className="text-[var(--text)]">tier=vip</span>{" "}
        <span className="text-[var(--muted)]">→ replace tier-free → tier-vip</span>
      </div>
      <div>
        <span className="text-[var(--accent)]">✓</span> <span className="text-[var(--muted)]">when</span>{" "}
        <span className="text-[var(--text)]">compliance=kid-safe</span>{" "}
        <span className="text-[var(--muted)]">→ replace compliance-standard</span>
      </div>
      <div>
        <span className="text-[var(--accent-rose)]">✕</span> <span className="text-[var(--muted)]">when</span>{" "}
        <span className="text-[var(--text)]">compliance=kid-safe</span>{" "}
        <span className="text-[var(--accent-rose)]">→ forbid sponsor-mention</span>
      </div>
      <div className="text-[var(--subtle)]">order: persona → guardrails → … → locale</div>
      <div className="text-[var(--subtle)]">
        warnings: <span className="text-[var(--accent)]">0</span> · byte-identical on every run
      </div>
    </div>
  );
}

function MultiModelVisual() {
  return (
    <div className="landing-pane flex h-full flex-col justify-center gap-3 px-4 py-4">
      <pre className="overflow-x-auto font-mono text-[10.5px] leading-[1.8] text-[var(--muted)]">
        <span className="text-[var(--subtle)]">- when:</span> {"{ model: gpt }"}
        {"\n"}
        <span className="text-[var(--subtle)]">{"  replace:"}</span> {"{ format-prose: "}
        <span className="text-[var(--text)]">format-json</span>
        {" }"}
        {"\n"}
        <span className="text-[var(--subtle)]">- when:</span> {"{ model: claude }"}
        {"\n"}
        <span className="text-[var(--subtle)]">{"  replace:"}</span> {"{ format-prose: "}
        <span className="text-[var(--text)]">format-xml</span>
        {" }"}
      </pre>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[9.5px] tracking-[0.08em] text-[var(--subtle)]">
        <span>
          gpt → <span className="text-[var(--accent)]">JSON</span>
        </span>
        <span>
          claude → <span className="text-[var(--accent)]">XML</span>
        </span>
        <span>
          default → <span className="text-[var(--accent)]">prose</span>
        </span>
      </div>
    </div>
  );
}

function CascadeVisual() {
  return (
    <div className="flex h-full flex-col justify-center gap-2">
      {[
        { n: "1", label: "base order", detail: "persona · guardrails · task · format", accent: false },
        { n: "2", label: "later rule wins", detail: "when tier=vip → replace tier-free", accent: false },
        { n: "3", label: "forbid — final filter", detail: "always wins, no solver", accent: true },
      ].map((layer) => (
        <div
          key={layer.n}
          className="landing-pane flex items-baseline gap-3 px-4 py-2.5 font-mono text-[10.5px]"
          style={
            layer.accent
              ? { borderColor: "color-mix(in oklab, var(--accent-rose) 45%, var(--border))" }
              : undefined
          }
        >
          <span className={layer.accent ? "text-[var(--accent-rose)]" : "text-[var(--accent)]"}>
            {layer.n}
          </span>
          <span className="whitespace-nowrap text-[var(--text)]">{layer.label}</span>
          <span className="truncate text-[var(--subtle)]">{layer.detail}</span>
        </div>
      ))}
    </div>
  );
}

function CliVisual() {
  return (
    <div className="landing-pane flex h-full flex-col justify-center gap-3 px-4 py-4 font-mono text-[10.5px] leading-[1.8]">
      <div className="overflow-x-auto whitespace-nowrap">
        <div>
          <span className="text-[var(--accent)]">$</span>{" "}
          <span className="text-[var(--text)]">npx skills add markbrutx/promptbook</span>
        </div>
        <div className="text-[var(--subtle)]">→ install · migrate · doctor · annotations</div>
        <div className="mt-2">
          <span className="text-[var(--accent)]">$</span>{" "}
          <span className="text-[var(--text)]">
            promptbook resolve sponsor-mention --ctx compliance=kid-safe
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-2.5 gap-y-1 border-t border-[var(--border)] pt-3 text-[9.5px] tracking-[0.1em] text-[var(--subtle)]">
        {["resolve", "ls", "lint", "eval", "bundle", "watch", "view"].map((verb) => (
          <span key={verb}>{verb}</span>
        ))}
      </div>
    </div>
  );
}

/* ---------- The problem: before / after panes ---------- */

function ProblemPane({
  file,
  badge,
  tone,
  caption,
  children,
}: {
  file: string;
  badge: string;
  tone: "pain" | "fix";
  caption: string;
  children: ReactNode;
}) {
  const badgeColor = tone === "pain" ? "var(--accent-rose)" : "var(--accent)";
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="landing-card flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <span className="truncate font-mono text-[10.5px] text-[var(--subtle)]">{file}</span>
          <span
            className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.24em]"
            style={{ color: badgeColor }}
          >
            {badge}
          </span>
        </div>
        <pre className="flex-1 overflow-x-auto px-5 py-4 font-mono text-[11.5px] leading-[1.75]">
          {children}
        </pre>
      </div>
      <p className="max-w-[52ch] px-1 text-[13.5px] leading-[1.55] text-[var(--muted)]">{caption}</p>
    </div>
  );
}

/* ---------- How it works: step + artifact panes ---------- */

function Step({
  n,
  title,
  body,
  children,
}: {
  n: string;
  title: string;
  body: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-col gap-3">
        <span className="font-mono text-[11px] tracking-[0.28em] text-[var(--accent)]">{n}</span>
        <h3
          className="font-display text-[1.5rem] leading-tight font-medium tracking-[-0.01em] text-[var(--text)]"
          style={{ fontStyle: "italic", fontVariationSettings: "'SOFT' 70, 'opsz' 40" }}
        >
          {title}
        </h3>
        <p className="max-w-[46ch] text-[14px] leading-[1.62] text-[var(--muted)]">{body}</p>
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}

function FileLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.2em] text-[var(--subtle)]">
      {children}
    </div>
  );
}

function ViewerMock() {
  const segments: { id: string; color: string; width: string; label: string }[] = [
    { id: "persona", color: "var(--accent)", width: "84%", label: "persona" },
    { id: "tone", color: "var(--accent-rose)", width: "58%", label: "reply-tone-terse" },
    { id: "guardrails", color: "var(--accent-warm)", width: "70%", label: "guardrails" },
    { id: "format", color: "var(--text)", width: "64%", label: "reply-format-xml" },
  ];
  return (
    <div className="landing-card flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
        <span className="truncate font-mono text-[10.5px] text-[var(--subtle)]">promptbook view</span>
        <span className="flex shrink-0 items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.2em] text-[var(--subtle)]">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />
          localhost
        </span>
      </div>
      <div className="flex flex-1">
        <div className="flex w-[104px] shrink-0 flex-col gap-2.5 border-r border-[var(--border)] px-4 py-4 font-mono text-[10px]">
          <span className="text-[var(--accent)]">▸ reply</span>
          <span className="text-[var(--subtle)]">escalation</span>
          <span className="mt-auto text-[var(--whisper)]">graph ⌘G</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-3.5 px-4 py-4">
          <div className="flex flex-wrap gap-1.5">
            {["tone=terse", "model=claude", "locale=de"].map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-[var(--border)] px-2 py-0.5 font-mono text-[9px] tracking-[0.06em] text-[var(--muted)]"
              >
                {chip}
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            {segments.map((seg) => (
              <div key={seg.id} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: seg.color }} />
                <span
                  className="h-[6px] rounded-full"
                  style={{
                    width: seg.width,
                    background: `color-mix(in oklab, ${seg.color} 26%, var(--surface-2))`,
                  }}
                />
                <span className="hidden font-mono text-[8.5px] whitespace-nowrap text-[var(--subtle)] min-[420px]:inline">
                  {seg.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- FAQ ---------- */

function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 border-t border-[var(--border)] pt-5">
      <h3 className="text-[15.5px] font-medium tracking-[-0.005em] text-[var(--text)]">{q}</h3>
      <p className="max-w-[56ch] text-[14px] leading-[1.65] text-[var(--muted)]">{children}</p>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="bg-grain flex min-h-dvh flex-col bg-[var(--ink)] text-[var(--text)]">
      <header className="relative z-10 border-b border-[var(--border)]">
        <div className="mx-auto flex h-16 w-full max-w-[76rem] items-center justify-between gap-6 px-6">
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
              className="font-display text-[17px] tracking-[-0.01em] text-[var(--text)] max-[419px]:hidden"
              style={{ fontStyle: "italic", fontVariationSettings: "'SOFT' 60, 'opsz' 24" }}
            >
              promptbook
            </span>
          </Link>
          <nav className="flex shrink-0 items-center gap-6 font-mono text-[10.5px] uppercase tracking-[0.28em] text-[var(--muted)]">
            <a href="#how-it-works" className="hidden transition hover:text-[var(--text)] md:inline">
              How it works
            </a>
            <a href="#why" className="hidden transition hover:text-[var(--text)] md:inline">
              Why
            </a>
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

      <main className="flex-1">
        {/* ---------- Hero ---------- */}
        <section className="relative overflow-hidden">
          <div className="hero-glow" aria-hidden="true" />
          <div className="relative mx-auto grid w-full max-w-[76rem] grid-cols-1 gap-12 px-6 pt-16 pb-14 lg:grid-cols-[minmax(0,42fr)_minmax(0,58fr)] lg:items-center lg:gap-14 lg:pt-24 lg:pb-24">
            <div className="flex min-w-0 flex-col gap-8">
              <span className="reveal font-mono text-[10.5px] uppercase tracking-[0.32em] text-[var(--subtle)]">
                open source · deterministic · model-agnostic
              </span>
              <h1
                className="reveal reveal-2 font-display text-[3rem] leading-[1.02] font-medium tracking-[-0.022em] text-[var(--text)] sm:text-[3.8rem] lg:text-[4.1rem]"
                style={{ fontStyle: "italic", fontVariationSettings: "'SOFT' 100, 'opsz' 144" }}
              >
                Stop shipping prompts you can&rsquo;t <span className="text-[var(--accent)]">see</span>.
              </h1>
              <p className="reveal reveal-3 max-w-[46ch] text-[16.5px] leading-[1.6] text-[var(--muted)]">
                System prompts end up as string spaghetti scattered through your codebase — nobody knows
                what&rsquo;s shared, what&rsquo;s safe to change, or what the model actually receives.
                promptbook turns them into a folder of small plain files you can see: Storybook for prompts,
                with an Obsidian-style graph.
              </p>

              <div className="reveal reveal-4 flex flex-col gap-3">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-[var(--subtle)]">
                  Feed the skill to your agent
                </span>
                <CopyCode code="npx skills add markbrutx/promptbook" size="lg" />
                <span className="font-mono text-[11px] leading-[1.5] text-[var(--muted)]">
                  Your agent reads it, then writes fragments and rules for you.
                </span>
              </div>

              <div className="reveal reveal-5 flex flex-wrap gap-3">
                <PrimaryCta href="/demo/sports-broadcast">Open the live demo</PrimaryCta>
                <GhostCta href="/docs">Read the docs</GhostCta>
              </div>
            </div>

            <div className="reveal reveal-3 flex min-w-0 flex-col gap-3">
              <div className="landing-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
                  <span className="font-mono text-[10px] tracking-[0.14em] text-[var(--muted)]">
                    examples/sports-broadcast
                  </span>
                  <span className="flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.24em] text-[var(--subtle)]">
                    <span
                      className="live-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]"
                      aria-hidden="true"
                    />
                    live graph
                  </span>
                </div>
                <div className="relative h-[380px] sm:h-[460px] lg:h-[540px]">
                  <PromptGraph
                    src="/demo/sports-broadcast/graph.json"
                    ariaLabel="Force-directed graph of the sports-broadcast demo book: 10 compositions connected to 30 shared fragments"
                  />
                  <span className="pointer-events-none absolute right-4 bottom-3 hidden font-mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--subtle)] sm:block">
                    hover to trace · drag to pull
                  </span>
                </div>
              </div>
              <span className="px-1 text-right font-mono text-[10px] tracking-[0.12em] text-[var(--subtle)]">
                a real prompt system — every node is a file, every edge a reference
              </span>
            </div>
          </div>
        </section>

        {/* ---------- The problem ---------- */}
        <section className="border-t border-[var(--border)]">
          <div className="mx-auto flex w-full max-w-[76rem] flex-col gap-10 px-6 py-20 lg:py-24">
            <SectionHeading
              eyebrow="the problem"
              title="This is in your codebase right now."
              sub="Prompt logic hides in template literals: conditionals buried in strings, copies drifting across files, no way to tell which variants exist. A book makes the same logic visible — as data, not code."
            />
            <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-5">
              <ProblemPane
                file="app/reply.ts"
                badge="today"
                tone="pain"
                caption="Which variants exist? What changed last sprint? What does the model actually receive? grep and pray."
              >
                <span className="text-[var(--muted)]">const</span>{" "}
                <span className="text-[var(--text)]">system</span> ={" "}
                <span className="text-[var(--text)]">{"`You are a support assistant"}</span>
                {"\n"}
                <span className="text-[var(--text)]">{"for ${brand}. Be concise."}</span>
                <span className="text-[var(--accent-rose)]">{"${"}</span>
                {"\n"}
                <span className="text-[var(--accent-rose)]">{'  tone === "terse"'}</span>
                {"\n"}
                <span className="text-[var(--accent-rose)]">{"    ? TERSE_RULES : WARM_RULES"}</span>
                {"\n"}
                <span className="text-[var(--accent-rose)]">{"}${"}</span>
                <span className="text-[var(--accent-rose)]">{'locale === "de" ? DE_RULES : ""'}</span>
                <span className="text-[var(--accent-rose)]">{"}"}</span>
                <span className="text-[var(--text)]">{"`"}</span>;{"\n\n"}
                <span className="text-[var(--subtle)]">{"// three sprints later, in another file…"}</span>
                {"\n"}
                <span className="text-[var(--muted)]">const</span>{" "}
                <span className="text-[var(--text)]">escalation</span> ={" "}
                <span className="text-[var(--text)]">SYSTEM_V2</span>
                {"\n"}
                <span className="text-[var(--text)]">{'  .replace("{persona}", persona)'}</span> +{" "}
                <span className="text-[var(--text)]">formatFor(model)</span>
                {";"}
              </ProblemPane>
              <div
                className="flex items-center justify-center font-mono text-[1.4rem] text-[var(--accent)]"
                aria-hidden="true"
              >
                <span className="hidden lg:block">→</span>
                <span className="lg:hidden">↓</span>
              </div>
              <ProblemPane
                file="prompts/"
                badge="with promptbook"
                tone="fix"
                caption="Same logic, as files. Every variant browsable, every edit's blast radius visible before it ships."
              >
                <span className="text-[var(--text)]">prompts/</span>
                {"\n"}
                <span className="text-[var(--subtle)]">{"├─ "}</span>
                <span className="text-[var(--text)]">fragments/</span>
                {"\n"}
                <span className="text-[var(--subtle)]">{"│  ├─ "}</span>
                <span className="text-[var(--muted)]">persona.md</span>
                {"\n"}
                <span className="text-[var(--subtle)]">{"│  ├─ "}</span>
                <span className="text-[var(--muted)]">reply-tone-warm.md</span>
                {"\n"}
                <span className="text-[var(--subtle)]">{"│  ├─ "}</span>
                <span className="text-[var(--muted)]">reply-tone-terse.md</span>
                {"\n"}
                <span className="text-[var(--subtle)]">{"│  └─ "}</span>
                <span className="text-[var(--muted)]">guardrails.md</span>
                {"\n"}
                <span className="text-[var(--subtle)]">{"└─ "}</span>
                <span className="text-[var(--text)]">rules/</span>
                {"\n"}
                <span className="text-[var(--subtle)]">{"   └─ "}</span>
                <span className="text-[var(--muted)]">reply.yaml</span>
                {"\n\n"}
                <span className="text-[var(--subtle)]">{"# the whole decision, one rule:"}</span>
                {"\n"}
                <span className="text-[var(--text)]">{"- when: { tone: terse }"}</span>
                {"\n"}
                <span className="text-[var(--text)]">{"  "}</span>
                <span className="text-[var(--accent)]">replace:</span>
                <span className="text-[var(--text)]">{" { reply-tone-warm: reply-tone-terse }"}</span>
              </ProblemPane>
            </div>
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section id="how-it-works" className="border-t border-[var(--border)]">
          <div className="mx-auto flex w-full max-w-[76rem] flex-col gap-12 px-6 py-20 lg:py-24">
            <SectionHeading
              eyebrow="how it works"
              title="Three moves. No framework."
              sub="Plain files in, one pure function out. The engine never calls a model — the only stochastic step stays in your code, behind an adapter."
            />
            <div className="grid gap-10 lg:grid-cols-3 lg:gap-6">
              <Step
                n="01"
                title="Put prompts in a folder"
                body="Fragments are Markdown, rules are YAML — data, not code. They diff, review and version like everything else in your repo. One command scaffolds it: npx @markbrutx/promptbook-cli init."
              >
                <div className="landing-card flex flex-1 flex-col overflow-hidden">
                  <div className="border-b border-[var(--border)] px-5 py-4">
                    <FileLabel>fragments/persona.md</FileLabel>
                    <pre className="overflow-x-auto font-mono text-[11px] leading-[1.7]">
                      <span className="text-[var(--subtle)]">---</span>
                      {"\n"}
                      <span className="text-[var(--muted)]">id:</span>{" "}
                      <span className="text-[var(--text)]">persona</span>
                      {"\n"}
                      <span className="text-[var(--subtle)]">---</span>
                      {"\n"}
                      <span className="text-[var(--muted)]">You are a support assistant for </span>
                      <span className="text-[var(--accent)]">{"${brand}"}</span>
                      <span className="text-[var(--muted)]">
                        .{"\n"}Warm, precise, never invents order data.
                      </span>
                    </pre>
                  </div>
                  <div className="px-5 py-4">
                    <FileLabel>rules/reply.yaml</FileLabel>
                    <pre className="overflow-x-auto font-mono text-[11px] leading-[1.7]">
                      <span className="text-[var(--muted)]">base:</span>{" "}
                      <span className="text-[var(--text)]">[persona, reply-tone-warm,</span>
                      {"\n"}
                      <span className="text-[var(--text)]">{"       guardrails, reply-task, locale]"}</span>
                      {"\n"}
                      <span className="text-[var(--muted)]">rules:</span>
                      {"\n"}
                      <span className="text-[var(--text)]">{"  - when: { tone: terse }"}</span>
                      {"\n"}
                      <span className="text-[var(--text)]">{"    "}</span>
                      <span className="text-[var(--accent)]">replace:</span>
                      <span className="text-[var(--text)]">{" { reply-tone-warm:"}</span>
                      {"\n"}
                      <span className="text-[var(--text)]">{"               reply-tone-terse }"}</span>
                    </pre>
                  </div>
                </div>
              </Step>
              <Step
                n="02"
                title="See the whole system"
                body={
                  <>
                    <code className="font-mono text-[12.5px] text-[var(--text)]">promptbook view</code> is
                    Storybook for your prompts: browse every assembled variant, flip a context axis, watch it
                    re-assemble — or zoom out to the graph.
                  </>
                }
              >
                <ViewerMock />
              </Step>
              <Step
                n="03"
                title="Ship with resolve()"
                body="Same folder + same context → byte-identical prompt, in Node, edge or browser. The trace explains every decision."
              >
                <div className="landing-card flex flex-1 flex-col overflow-hidden">
                  <div className="px-5 py-4">
                    <FileLabel>app.ts</FileLabel>
                    <pre className="overflow-x-auto font-mono text-[11px] leading-[1.75]">
                      <span className="text-[var(--muted)]">import</span>{" "}
                      <span className="text-[var(--text)]">{"{ resolve }"}</span>{" "}
                      <span className="text-[var(--muted)]">from</span>
                      {"\n  "}
                      <span className="text-[var(--text)]">&quot;@markbrutx/promptbook-core&quot;</span>
                      {";\n\n"}
                      <span className="text-[var(--muted)]">const</span>{" "}
                      <span className="text-[var(--text)]">{"{ text, trace }"}</span> ={" "}
                      <span className="text-[var(--muted)]">await</span>{" "}
                      <span className="text-[var(--accent)]">resolve</span>({"{"}
                      {"\n"}
                      <span className="text-[var(--text)]">{'  promptsDir: "./prompts",'}</span>
                      {"\n"}
                      <span className="text-[var(--text)]">{'  prompt: "reply",'}</span>
                      {"\n"}
                      <span className="text-[var(--text)]">
                        {'  context: { tone: "terse",\n             model: "claude" },'}
                      </span>
                      {"\n"}
                      {"}"});{"\n\n"}
                      <span className="text-[var(--subtle)]">
                        {"// text  → the exact prompt, every time\n// trace → which rules fired, and why"}
                      </span>
                    </pre>
                  </div>
                </div>
              </Step>
            </div>
          </div>
        </section>

        {/* ---------- Who it's for ---------- */}
        <section className="border-t border-[var(--border)]">
          <div className="mx-auto grid w-full max-w-[76rem] gap-5 px-6 py-16 md:grid-cols-3 lg:py-20">
            {[
              {
                eyebrow: "for developers",
                title: "Edit without fear",
                body: "Every fragment knows which prompts use it. See the blast radius of a change before it ships — not in an incident review.",
              },
              {
                eyebrow: "for agents",
                title: "A safe prompt engineer",
                body: "One skills command teaches your coding agent to read, edit and migrate prompt books without breaking them.",
              },
              {
                eyebrow: "for teams",
                title: "Review prompts like code",
                body: "Plain files diff cleanly in PRs. Lint flags dead fragments, eval pins fixtures — prompt changes get code-grade review.",
              },
            ].map((card) => (
              <article key={card.eyebrow} className="landing-card flex min-w-0 flex-col gap-3 p-6 sm:p-7">
                <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--accent)]">
                  {card.eyebrow}
                </span>
                <h3
                  className="font-display text-[1.35rem] leading-tight font-medium tracking-[-0.01em] text-[var(--text)]"
                  style={{ fontStyle: "italic", fontVariationSettings: "'SOFT' 70, 'opsz' 40" }}
                >
                  {card.title}
                </h3>
                <p className="max-w-[46ch] text-[14px] leading-[1.62] text-[var(--muted)]">{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ---------- Feature cards ---------- */}
        <section id="why" className="border-t border-[var(--border)]">
          <div className="mx-auto flex w-full max-w-[76rem] flex-col gap-10 px-6 py-20 lg:py-24">
            <SectionHeading
              eyebrow="why promptbook"
              title={
                <>
                  Everything about a prompt,
                  <br className="hidden sm:block" />
                  <span className="sm:hidden"> </span>visible before you run it.
                </>
              }
              sub="Which fragments are shared, what is safe to change, and what the final prompt looks like under a given context — all answerable without a single model call."
            />
            <div className="grid gap-5 md:grid-cols-2">
              <FeatureCard
                title="Know what an edit breaks — before prod"
                body="Every fragment knows which compositions include it. Touch persona and all ten places it lands light up — the blast radius is on screen, not in an incident."
                visual={<UsedInVisual />}
              />
              <FeatureCard
                title="See what the model actually receives"
                body="Every composition, every variant, live. Flip a context axis and watch the prompt re-assemble, segments colored by the fragment they came from."
                visual={<ViewerVisual />}
              />
              <FeatureCard
                title="Same input, same prompt — provable"
                body="resolve() is pure: same folder + context → byte-identical output. The trace shows which rules fired and why, what got replaced, what forbid removed."
                visual={<TraceVisual />}
              />
              <FeatureCard
                title="One prompt, every model's dialect"
                body="The target model is just another context axis. One logical prompt compiles to a JSON contract for one model and XML tags for another — no forked copies."
                visual={<MultiModelVisual />}
              />
              <FeatureCard
                title="Overrides you can predict"
                body="CSS for prompts: rules apply in declaration order, later wins, forbid is the final filter. You can compute the outcome in your head — no solver to appease."
                visual={<CascadeVisual />}
              />
              <FeatureCard
                title="Agents and CI speak it natively"
                body="One command teaches your agent to write fragments and rules safely. The CLI gives CI the same verbs — lint dead fragments, gate bundles, eval fixtures."
                visual={<CliVisual />}
              />
            </div>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section className="border-t border-[var(--border)]">
          <div className="mx-auto flex w-full max-w-[76rem] flex-col gap-10 px-6 py-16 lg:py-20">
            <SectionHeading eyebrow="straight answers" title="The four questions everyone asks." />
            <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
              <Faq q="Is this a framework?">
                No. Three plain file kinds — Markdown fragments, YAML rules, JSON fixtures — plus one pure
                function. No orchestration, no chains, no lock-in: delete promptbook tomorrow and your prompts
                are still readable Markdown.
              </Faq>
              <Faq q="Does it call models?">
                Never. The engine is deterministic glue — resolve() just assembles a string. The model call
                stays in your code, behind whatever client you already use.
              </Faq>
              <Faq q="Which models does it work with?">
                All of them. The target model is just a context value, so one logical prompt can resolve to a
                different format per model — JSON for one, XML for another — without forking the text.
              </Faq>
              <Faq q="My prompts are already strings in code.">
                That&rsquo;s the expected starting point. The skill bundle includes a migrate skill: your
                coding agent moves string literals into a book incrementally, one prompt at a time.
              </Faq>
            </div>
          </div>
        </section>

        {/* ---------- CTA band ---------- */}
        <section className="border-t border-[var(--border)]">
          <div className="mx-auto w-full max-w-[76rem] px-6 py-20 lg:py-24">
            <div className="landing-card relative overflow-hidden px-6 py-16 text-center sm:py-20">
              <div className="cta-glow" aria-hidden="true" />
              <div className="relative flex flex-col items-center gap-6">
                <h2
                  className="font-display text-[2.6rem] leading-[1.02] font-medium tracking-[-0.02em] text-[var(--text)] sm:text-[3.4rem]"
                  style={{ fontStyle: "italic", fontVariationSettings: "'SOFT' 100, 'opsz' 144" }}
                >
                  Open the book<span className="text-[var(--accent)]">.</span>
                </h2>
                <p className="max-w-[52ch] text-[15.5px] leading-[1.6] text-[var(--muted)]">
                  The full sports-broadcast book — 10 compositions, 30 fragments, six context axes — running
                  entirely in your browser. No install, no model calls.
                </p>
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <PrimaryCta href="/demo/sports-broadcast">Run the demo</PrimaryCta>
                  <GhostCta href="/docs">Read the docs</GhostCta>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto flex w-full max-w-[76rem] flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {/* biome-ignore lint/performance/noImgElement: pixel-art mark renders cleaner with a raw <img> than next/image's srcset */}
            <img
              src="/promptbook-mini.png"
              alt=""
              width={45}
              height={36}
              className="block h-6 w-auto shrink-0 select-none"
              style={{ imageRendering: "pixelated", aspectRatio: "45 / 36" }}
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-[var(--subtle)]">
              storybook for prompts · MIT
            </span>
          </div>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-[0.32em] text-[var(--subtle)]">
            <Link href="/docs" className="transition hover:text-[var(--accent)]">
              Docs
            </Link>
            <Link href="/demo/sports-broadcast" className="transition hover:text-[var(--accent)]">
              Demo
            </Link>
            <a
              href="https://github.com/markbrutx/promptbook"
              rel="noopener noreferrer"
              target="_blank"
              className="transition hover:text-[var(--accent)]"
            >
              GitHub
            </a>
            <a
              href="https://skills.sh/markbrutx/promptbook"
              rel="noopener noreferrer"
              target="_blank"
              className="transition hover:text-[var(--accent)]"
            >
              skills.sh
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
