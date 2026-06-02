import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "promptbook · storybook for prompts";
export const dynamic = "force-static";

// Bundled-server `process.cwd()` is apps/site at build time; the fonts ride
// alongside the source so they survive the Next.js trace into the deployment.
const fontsDir = join(process.cwd(), "src", "og-fonts");

export default async function OG() {
  const [fraunces, jetbrains] = await Promise.all([
    readFile(join(fontsDir, "Fraunces-MediumItalic.woff")),
    readFile(join(fontsDir, "JetBrainsMono-Regular.woff")),
  ]);

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        padding: "80px 96px",
        background: "#0A0B0E",
        color: "#ECEEF1",
        fontFamily: "Fraunces",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontSize: 46,
          fontStyle: "italic",
          lineHeight: 1.18,
          letterSpacing: "-0.012em",
        }}
      >
        <div>System prompts are part of your code too.</div>
        <div>I didn’t like that they end up scattered</div>
        <div>all over the codebase, so I made</div>
        <div style={{ display: "flex" }}>
          <span style={{ color: "#B8FF66" }}>Storybook for prompts</span>
          <span>. Called it promptbook.</span>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 56,
          right: 96,
          fontFamily: "JetBrains Mono",
          fontSize: 18,
          letterSpacing: "0.32em",
          textTransform: "uppercase",
          color: "#5A5F69",
        }}
      >
        promptbook.dev
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Fraunces", data: fraunces, style: "italic", weight: 500 },
        { name: "JetBrains Mono", data: jetbrains, style: "normal", weight: 400 },
      ],
    },
  );
}
