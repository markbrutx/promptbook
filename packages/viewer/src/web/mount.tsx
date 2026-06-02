import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { App, type AppProps } from "./App.js";

export type { App, AppProps } from "./App.js";
export type { Api } from "./api.js";

/** Arguments to {@link mountWebApp}. */
export interface MountOptions extends AppProps {
  /** DOM node to mount the React tree into. */
  container: Element | DocumentFragment;
  /** Wrap in `<StrictMode>`. Defaults to true. */
  strict?: boolean;
}

/** Mount the viewer UI into `container` with the supplied API. */
export function mountWebApp(options: MountOptions): { unmount: () => void; root: Root } {
  const { container, api, subscribeReload, strict = true } = options;
  const root = createRoot(container);
  const appProps: AppProps = subscribeReload !== undefined ? { api, subscribeReload } : { api };
  const tree = <App {...appProps} />;
  root.render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  return {
    root,
    unmount: () => root.unmount(),
  };
}
