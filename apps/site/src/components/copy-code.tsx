"use client";

import { useState } from "react";

type CopyCodeProps = {
  code: string;
  prefix?: string;
  size?: "md" | "lg";
};

export function CopyCode({ code, prefix = "$", size = "md" }: CopyCodeProps) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // browser blocked clipboard access
    }
  }

  // Right padding ≥ fade width so a command that fits never sits under the fade.
  const padding = size === "lg" ? "py-5 pl-6 pr-10" : "py-4 pl-5 pr-10";
  const textSize = size === "lg" ? "text-[15.5px] sm:text-[16px]" : "text-[13.5px] sm:text-[14px]";

  // The copy chip lives outside the scroll area so overflowing commands can
  // never run underneath it; the gradient fades the code out instead.
  return (
    <div className="group relative flex items-center border border-[var(--border)] bg-[var(--surface-1)] transition hover:border-[var(--border-strong)]">
      <div className="relative min-w-0 flex-1">
        <pre className={`overflow-x-auto font-mono leading-[1.55] text-[var(--text)] ${padding} ${textSize}`}>
          <span className="select-none text-[var(--accent)]">{prefix}</span> <span>{code}</span>
        </pre>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-r from-transparent to-[var(--surface-1)]"
        />
      </div>
      <button
        type="button"
        onClick={onCopy}
        aria-label="copy command"
        className="mr-3 shrink-0 cursor-pointer select-none border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
      >
        {copied ? "copied" : "copy"}
      </button>
    </div>
  );
}
