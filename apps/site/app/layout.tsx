import { RootProvider } from "fumadocs-ui/provider";
import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans-next",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-next",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["SOFT", "opsz"],
  variable: "--font-display-next",
  display: "swap",
});

export const dynamic = "force-static";
export const revalidate = false;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "promptbook · deterministic prompt composition",
    template: "%s · promptbook",
  },
  description:
    "Compose prompts from reusable fragments via declarative rules. Agnostic core, deterministic resolve, no runtime model calls.",
};

export const viewport: Viewport = {
  themeColor: "#0A0B0E",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      style={{ colorScheme: "dark" }}
      className={`dark ${plexSans.variable} ${jetbrainsMono.variable} ${fraunces.variable}`}
    >
      <body className="flex min-h-dvh flex-col bg-[var(--ink)] text-[var(--text)] antialiased">
        <RootProvider theme={{ forcedTheme: "dark", defaultTheme: "dark", enableSystem: false }}>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
