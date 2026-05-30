import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The web app lives in src/web; its built assets land in dist/web, which the
// Node server serves as static files alongside the /api/* routes.
export default defineConfig({
  root: "src/web",
  plugins: [react()],
  build: {
    outDir: "../../dist/web",
    emptyOutDir: true,
  },
});
