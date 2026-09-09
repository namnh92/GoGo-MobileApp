#!/usr/bin/env node
/**
 * NTF-APP-009 (#173) — does the generated native project actually contain what
 * `app.config.ts` says it should?
 *
 * Two defects reached a device because nothing asked that question:
 *
 *  1. `plugins/with-onesignal-identity-beta.js` pins OneSignalXCFramework to
 *     the Identity Verification beta. `ios/` predated the plugin and was never
 *     regenerated, so pods resolved to 5.5.6 — which does not export
 *     `OSUserJwtInvalidatedListener` — and the Swift module stopped compiling.
 *  2. Worse, the stale `Pods/` did not contain the local Expo module at all.
 *     `xcodebuild` printed **BUILD SUCCEEDED** without ever compiling
 *     `OneSignalIdentityModule.swift`, shipped an app missing its native
 *     module, and the app died with SIGSEGV the moment JS called into it.
 *
 * A green build is exactly what (2) looks like, which is why this is a
 * separate check rather than something a build log would have shown.
 *
 * Every failure below is fatal and names the fix. Nothing here is advisory:
 * a check that warns is a check people learn to scroll past.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const problems = [];
const notes = [];

/** The pin `plugins/with-onesignal-identity-beta.js` is supposed to apply. */
const ONESIGNAL_BETA = "5.3.0-beta-03";

/** Local Expo modules: `modules/<name>/expo-module.config.json`. */
function localModules() {
  const dir = path.join(root, "modules");
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const config = path.join(dir, e.name, "expo-module.config.json");
      if (!existsSync(config)) return null;
      const parsed = JSON.parse(readFileSync(config, "utf8"));
      return {
        name: e.name,
        appleClasses: parsed.apple?.modules ?? parsed.ios?.modules ?? [],
        androidClasses: parsed.android?.modules ?? [],
      };
    })
    .filter(Boolean);
}

const modules = localModules();
if (modules.length === 0)
  problems.push(
    "no local Expo modules found under modules/ — expected at least one",
  );

// --- iOS -------------------------------------------------------------------

const podfile = path.join(root, "ios", "Podfile");
if (!existsSync(podfile)) {
  problems.push("ios/Podfile is missing — run `npx expo prebuild -p ios`");
} else {
  const contents = readFileSync(podfile, "utf8");
  if (!contents.includes(ONESIGNAL_BETA)) {
    problems.push(
      `ios/Podfile does not pin OneSignalXCFramework to ${ONESIGNAL_BETA}. ` +
        "The identity module only compiles against that beta. " +
        "Regenerate with `npx expo prebuild -p ios` so with-onesignal-identity-beta.js runs.",
    );
  } else notes.push(`ios/Podfile pins OneSignalXCFramework ${ONESIGNAL_BETA}`);

  if (!contents.includes("OSUserJwtInvalidatedListener")) {
    problems.push(
      "ios/Podfile is missing the post_install forward-declaration repair for " +
        "OneSignalFramework.h. Regenerate with `npx expo prebuild -p ios`.",
    );
  } else notes.push("ios/Podfile carries the post_install header repair");
}

/**
 * The check that would have caught the silent one. `Podfile.lock` and the
 * generated provider only exist after `pod install`; when they do, every local
 * module must appear in both. Absent means the app builds without it.
 */
const podfileLock = path.join(root, "ios", "Podfile.lock");
if (existsSync(podfileLock)) {
  const lock = readFileSync(podfileLock, "utf8").toLowerCase();
  for (const m of modules) {
    // CocoaPods normalises `onesignal-identity` to `OnesignalIdentity`.
    const pod = m.name
      .replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase())
      .toLowerCase();
    if (!lock.includes(pod) && !lock.includes(m.name.toLowerCase())) {
      problems.push(
        `ios/Podfile.lock does not contain local module "${m.name}". ` +
          "A build against these Pods links no native code for it and crashes at " +
          "first use. Run `npx expo prebuild -p ios && (cd ios && pod install)`.",
      );
    } else notes.push(`ios/Podfile.lock links ${m.name}`);
  }

  const provider = readdirSync(
    path.join(root, "ios", "Pods", "Target Support Files"),
    {
      withFileTypes: true,
    },
  )
    .filter((e) => e.isDirectory() && e.name.startsWith("Pods-"))
    .map((e) =>
      path.join(
        root,
        "ios",
        "Pods",
        "Target Support Files",
        e.name,
        "ExpoModulesProvider.swift",
      ),
    )
    .find(existsSync);
  if (provider) {
    const swift = readFileSync(provider, "utf8");
    for (const m of modules)
      for (const cls of m.appleClasses)
        if (!swift.includes(cls)) {
          problems.push(
            `ExpoModulesProvider.swift does not register ${cls} (from modules/${m.name}). ` +
              "The module will not exist at runtime.",
          );
        } else notes.push(`ExpoModulesProvider registers ${cls}`);
  }
} else {
  notes.push(
    "ios/Podfile.lock absent — skipped Pods checks (expected before `pod install`)",
  );
}

// --- Android ---------------------------------------------------------------

if (!existsSync(path.join(root, "android"))) {
  problems.push("android/ is missing — run `npx expo prebuild -p android`");
} else {
  // Autolinking is what puts a local module into the Gradle build; asking it
  // directly is closer to the truth than grepping generated Gradle files.
  try {
    const out = execFileSync(
      "npx",
      ["expo-modules-autolinking", "resolve", "-p", "android", "--json"],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    const resolved = JSON.parse(out.slice(out.indexOf("{")));
    const names = (resolved.modules ?? []).map((m) => m.packageName);
    for (const m of modules)
      if (!names.includes(m.name)) {
        problems.push(
          `android autolinking does not resolve local module "${m.name}"`,
        );
      } else notes.push(`android autolinking resolves ${m.name}`);
  } catch (error) {
    problems.push(
      `android autolinking could not be resolved: ${error.message.split("\n")[0]}`,
    );
  }
}

// --- report ----------------------------------------------------------------

for (const n of notes) console.log(`  ok: ${n}`);
if (problems.length > 0) {
  console.error("\nnative project check failed:");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(
  `\nnative project check passed (${modules.length} local module(s))`,
);
