import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "promptbook · deterministic prompt composition";
export const dynamic = "force-static";

export default async function OG() {
  // Inline the pixel-art mini logo as base64 so the OG renderer doesn't have to
  // resolve a runtime URL. Read at build time from the app's public dir.
  const logoPath = join(process.cwd(), "public", "promptbook-mini.png");
  const logoBuffer = await readFile(logoPath);
  const logoSrc = `data:image/png;base64,${logoBuffer.toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: 72,
        background: "#0A0B0E",
        color: "#ECEEF1",
        fontFamily: "system-ui",
        backgroundImage:
          "linear-gradient(to right, rgba(184,255,102,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(184,255,102,0.05) 1px, transparent 1px)",
        backgroundSize: "64px 64px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* biome-ignore lint/performance/noImgElement: next/og requires raw img */}
          <img src={logoSrc} alt="" width={88} height={70} style={{ imageRendering: "pixelated" }} />
          <span style={{ fontSize: 22, letterSpacing: 10, color: "#B8FF66", textTransform: "uppercase" }}>
            § 00 · promptbook
          </span>
        </div>
        <span style={{ fontSize: 18, letterSpacing: 6, color: "#8B919C", textTransform: "uppercase" }}>
          open source · MIT
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <h1
          style={{
            fontSize: 84,
            fontWeight: 500,
            letterSpacing: -2,
            lineHeight: 1.02,
            margin: 0,
            color: "#ECEEF1",
            maxWidth: 1000,
          }}
        >
          Deterministic prompt composition
          <br />
          <span style={{ color: "#B8FF66" }}>from reusable fragments.</span>
        </h1>
        <p style={{ fontSize: 26, color: "#8B919C", margin: 0, maxWidth: 880, lineHeight: 1.4 }}>
          WHAT · WHEN · HOW. Held strictly separate.
        </p>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 20, letterSpacing: 6, color: "#5A5F69", textTransform: "uppercase" }}>
          $ npx skills add markbrutx/promptbook
        </span>
        <span style={{ fontSize: 20, letterSpacing: 6, color: "#5A5F69", textTransform: "uppercase" }}>
          field manual · v0
        </span>
      </div>
    </div>,
    size,
  );
}
