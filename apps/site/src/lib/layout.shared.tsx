import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="flex items-center gap-2">
          {/* biome-ignore lint/performance/noImgElement: pixel art renders cleaner without next/image srcset */}
          <img
            src="/promptbook-mini.png"
            alt=""
            width={30}
            height={24}
            style={{ imageRendering: "pixelated", aspectRatio: "45 / 36" }}
            className="block h-5 w-auto shrink-0 select-none"
          />
          <span
            className="font-display text-[15px] tracking-[-0.01em]"
            style={{ fontStyle: "italic", fontVariationSettings: "'SOFT' 60, 'opsz' 24" }}
          >
            promptbook
          </span>
        </span>
      ),
      url: "/",
    },
    githubUrl: "https://github.com/markbrutx/promptbook",
    links: [{ text: "Docs", url: "/docs" }],
  };
}
