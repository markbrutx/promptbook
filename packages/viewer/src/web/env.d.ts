// Vite resolves CSS side-effect imports at build time; this declaration lets
// the type-checker accept `import "./styles.css"` without pulling vite/client.
declare module "*.css";
