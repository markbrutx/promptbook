import { createMDX } from "fumadocs-mdx/next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: false,
  // promptbook-viewer/web ships TSX source; teach webpack to resolve the
  // NodeNext-style `.js` import extensions back to `.tsx`/`.ts`.
  transpilePackages: ["@markbrutx/promptbook-core", "@markbrutx/promptbook-viewer"],
  typedRoutes: false,
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".tsx", ".ts", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

const withMDX = createMDX();

export default withMDX(nextConfig);
