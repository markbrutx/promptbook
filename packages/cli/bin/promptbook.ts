#!/usr/bin/env node
import { run } from "../src/run.js";

process.exit(await run(process.argv.slice(2)));
