import type { ParsedArgs } from "../args.js";
import { requirePromptsDir } from "../config.js";
import type { IO } from "../io.js";

/** Options forwarded to `@promptbook/viewer`'s `startViewer`. */
export interface ViewerStartOptions {
  promptsDir: string;
  port?: number;
  open: boolean;
}

/** The subset of the viewer's running handle the CLI uses. */
export interface ViewerHandle {
  url: string;
  close(): Promise<void>;
}

/**
 * Injectable seam for `view`: how to start the viewer and how to keep the
 * process alive. Defaults dynamically import the optional `@promptbook/viewer`
 * package and block until a termination signal; tests inject fakes so no
 * server or signal handling is needed.
 */
export interface ViewDeps {
  start(options: ViewerStartOptions): Promise<ViewerHandle>;
  hold(handle: ViewerHandle): Promise<number>;
}

/** Thrown by the default `start` when the optional viewer package is absent. */
class ViewerNotInstalledError extends Error {}

interface ViewerModule {
  startViewer(options: ViewerStartOptions): Promise<ViewerHandle>;
}

const defaultViewDeps: ViewDeps = {
  async start(options) {
    let mod: ViewerModule;
    try {
      mod = (await import("@promptbook/viewer")) as unknown as ViewerModule;
    } catch {
      throw new ViewerNotInstalledError();
    }
    return mod.startViewer(options);
  },
  hold(handle) {
    return new Promise<number>((resolve) => {
      const shutdown = (): void => {
        void handle.close().then(() => resolve(0));
      };
      process.once("SIGINT", shutdown);
      process.once("SIGTERM", shutdown);
    });
  },
};

/**
 * `view`: start the local web viewer over the prompts folder, print its URL,
 * and keep running until interrupted. Render-only; the viewer makes no model
 * calls. `--no-open` skips launching the browser; `--port` pins the port.
 */
export async function cmdView(args: ParsedArgs, io: IO, deps: ViewDeps = defaultViewDeps): Promise<number> {
  const promptsDir = await requirePromptsDir(io, args.dir);
  if (promptsDir === null) {
    return 1;
  }

  let handle: ViewerHandle;
  try {
    handle = await deps.start({ promptsDir, port: args.port, open: !args.noOpen });
  } catch (error) {
    if (error instanceof ViewerNotInstalledError) {
      io.stderr('error: the viewer is not installed. Add it with "npm i -D @promptbook/viewer".\n');
      return 1;
    }
    io.stderr(`error: ${(error as Error).message}\n`);
    return 1;
  }

  io.stdout(`promptbook viewer running at ${handle.url}\n`);
  return deps.hold(handle);
}
