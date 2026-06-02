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

  const padding = size === "lg" ? "px-6 py-5 pr-20" : "px-5 py-4 pr-16";
  const textSize = size === "lg" ? "text-[15.5px] sm:text-[16px]" : "text-[13.5px] sm:text-[14px]";

  return (
    <div className="group relative border border-[var(--border)] bg-[var(--surface-1)] transition hover:border-[var(--border-strong)]">
      <pre className={`overflow-x-auto font-mono leading-[1.55] text-[var(--text)] ${padding} ${textSize}`}>
        <span className="select-none text-[var(--accent)]">{prefix}</span> <span>{code}</span>
      </pre>
      <button
        type="button"
        onClick={onCopy}
        aria-label="copy command"
        className="absolute top-2.5 right-3 cursor-pointer select-none border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
      >
        {copied ? "copied" : "copy"}
      </button>
    </div>
  );
}
