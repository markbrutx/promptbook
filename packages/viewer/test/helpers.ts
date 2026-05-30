import { fileURLToPath } from "node:url";

/** Absolute path to the neutral sample prompts folder used across tests. */
export const sampleDir = fileURLToPath(new URL("./fixtures/sample", import.meta.url));
