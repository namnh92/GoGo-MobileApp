#!/usr/bin/env node
/**
 * GoGo-MobileApp#340, ADR-0011 D-5 phase 2 — which SENTRY_* variables would
 * Expo's dotenv load define?
 *
 * `expo run` loads the project's dotenv files through `@expo/env` after
 * `scripts/release-build.sh` has checked its environment, so an assignment in
 * one of them reaches the native build unchecked. The script refuses any file
 * that assigns a SENTRY_* variable — and the question "does this line assign?"
 * is answered here by the very parser `@expo/env` uses (`dotenv`, resolved
 * through `expo`'s own dependency tree), not by a regex that has to track its
 * grammar. dotenv accepts `KEY=value`, `export KEY=value` and `KEY: value`
 * (Astra F-20, round 2), and ignores comments.
 *
 * Values never leave this process: only file names and variable names are
 * printed, one `file<TAB>NAME` per line, and the exit code is 1 when there is
 * any. Exit 2 means the parser could not be resolved (no `node_modules`).
 *
 * CLI: `node scripts/lib/dotenv-sentry-keys.mjs <file>...`
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

function resolveExpoDotenv(root) {
  const fromRoot = createRequire(path.join(root, "package.json"));
  const expoPkg = fromRoot.resolve("expo/package.json");
  const envPkg = createRequire(expoPkg).resolve("@expo/env/package.json");
  return createRequire(envPkg)("dotenv");
}

function sentryKeysOf(parse, text) {
  return Object.keys(parse(text)).filter((key) => key.startsWith("SENTRY_"));
}

const files = process.argv.slice(2);
let dotenv;
try {
  dotenv = resolveExpoDotenv(process.cwd());
} catch (error) {
  process.stderr.write(`dotenv-sentry-keys: cannot resolve @expo/env's dotenv parser from ${process.cwd()} — run pnpm install (${error.code ?? error.message})\n`);
  process.exit(2);
}

let found = 0;
for (const file of files) {
  for (const key of sentryKeysOf(dotenv.parse, readFileSync(file, "utf8"))) {
    process.stdout.write(`${file}\t${key}\n`);
    found += 1;
  }
}
process.exit(found > 0 ? 1 : 0);
