#!/usr/bin/env node
/**
 * GoGo-MobileApp#340, ADR-0011 D-5 phase 2 — is the generated native project
 * actually wired to upload to Sentry?
 *
 * `@sentry/react-native/expo` (8.30.0) writes four things at prebuild. A native
 * project missing any of them builds green and uploads nothing, so a marker
 * anywhere in the file is not enough: each check reads the one place the build
 * executes, and rejects the two ways the plugin itself can switch an upload off
 * at prebuild time (`disableAutoUpload`), because that decision belongs to the
 * build's environment (`scripts/release-build.sh`), not to the generated tree.
 *
 *   iOS      the application target's buildPhases list both the "Bundle React
 *            Native code and images" phase, whose shellScript runs
 *            sentry-xcode.sh (source map), and an "Upload Debug Symbols to Sentry"
 *            phase whose shellScript runs sentry-xcode-debug-files.sh (dSYMs).
 *            Neither script bakes a `SENTRY_*=` assignment. A phase that exists
 *            but hangs off the notification-service extension never runs for the
 *            app, so membership is checked on the application target, by id.
 *   Android  an `apply from: … "sentry.gradle.kts")` line outside any comment in
 *            app/build.gradle, and no `shouldSentryAutoUploadGeneral` override
 *            (what the plugin writes for `disableAutoUpload: true`).
 *   both     <platform>/sentry.properties names gogo-vn/gogo-mobile and carries
 *            no auth.token — the token lives in the build's environment only.
 *
 * Used by `scripts/check-native-project.mjs` (CI) and by `scripts/release-build.sh`
 * before a build that has a token. CLI: `node scripts/lib/sentry-native.mjs <root> <ios|android>`
 * prints one problem per line and exits 1 when there is any.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BUNDLE_PHASE = "Bundle React Native code and images";
const SYMBOLS_PHASE = "Upload Debug Symbols to Sentry";
const APPLICATION = '"com.apple.product-type.application"';

/** Every top-level PBX object: `{ id, comment, body }`. Nested blocks sit deeper than two tabs. */
function pbxObjects(project) {
  return [...project.matchAll(/^\t\t([0-9A-F]{24}) \/\* (.*?) \*\/ = \{\n([\s\S]*?)^\t\t\};/gm)].map((m) => ({
    id: m[1],
    comment: m[2],
    body: m[3],
  }));
}

/** The one shell-script phase Xcode annotates with `name`, or null. */
function shellPhase(objects, name) {
  const phase = objects.find((o) => o.comment === name && /^\t\t\tisa = PBXShellScriptBuildPhase;$/m.test(o.body));
  if (!phase) return null;
  const match = /^\t\t\tshellScript = (".*");$/m.exec(phase.body);
  return { id: phase.id, script: match ? JSON.parse(match[1]) : "" };
}

/** Ids listed in a target's `buildPhases = ( … );`. */
function buildPhaseIds(targetBody) {
  const match = /^\t\t\tbuildPhases = \(\n([\s\S]*?)^\t\t\t\);/m.exec(targetBody);
  return match ? [...match[1].matchAll(/^\t\t\t\t([0-9A-F]{24}) \/\*/gm)].map((m) => m[1]) : [];
}

/** A `SENTRY_X=` line in a phase is the plugin's `disableAutoUpload`, or a hand edit. */
const BAKED_VARIABLE = /^\s*(?:export\s+)?(SENTRY_[A-Z0-9_]+)=/m;

/** Problems with the iOS project text; `[]` when the app target uploads both artifacts. */
export function iosProblems(project) {
  const problems = [];
  const objects = pbxObjects(project);

  const bundle = shellPhase(objects, BUNDLE_PHASE);
  if (bundle === null) {
    problems.push(`the Xcode project has no '${BUNDLE_PHASE}' phase`);
  } else if (!bundle.script.includes("/scripts/sentry-xcode.sh")) {
    problems.push(`the Xcode '${BUNDLE_PHASE}' phase does not run sentry-xcode.sh — Release builds would upload no source map`);
  }

  const symbols = shellPhase(objects, SYMBOLS_PHASE);
  if (symbols === null) {
    problems.push(`the Xcode project has no '${SYMBOLS_PHASE}' phase — native crashes would stay unsymbolicated`);
  } else if (!symbols.script.includes("/scripts/sentry-xcode-debug-files.sh")) {
    problems.push(`the '${SYMBOLS_PHASE}' phase does not run sentry-xcode-debug-files.sh`);
  }

  for (const [name, phase] of [
    [BUNDLE_PHASE, bundle],
    [SYMBOLS_PHASE, symbols],
  ]) {
    const baked = phase && BAKED_VARIABLE.exec(phase.script);
    if (baked) {
      problems.push(
        `the '${name}' phase bakes ${baked[1]}= into the project — the plugin was given disableAutoUpload, ` +
          "or the phase was hand-edited; whether a build uploads is decided per build by scripts/release-build.sh",
      );
    }
  }

  const apps = objects.filter(
    (o) => /^\t\t\tisa = PBXNativeTarget;$/m.test(o.body) && o.body.includes(`productType = ${APPLICATION};`),
  );
  if (apps.length === 0) {
    problems.push("the Xcode project has no application target (productType com.apple.product-type.application)");
  }
  for (const app of apps) {
    const ids = buildPhaseIds(app.body);
    for (const [name, phase] of [
      [BUNDLE_PHASE, bundle],
      [SYMBOLS_PHASE, symbols],
    ]) {
      if (phase && !ids.includes(phase.id)) {
        problems.push(
          `the '${name}' phase exists but is not in the application target '${app.comment}' buildPhases — ` +
            "the app build never runs it",
        );
      }
    }
  }
  return problems;
}

/** Gradle text with `/* … */` blocks and whole-line `//` comments removed. */
function stripGradleComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

/** Problems with android/app/build.gradle text. */
export function androidProblems(appGradle) {
  const code = stripGradleComments(appGradle);
  const problems = [];
  if (!/^apply from: .*"sentry\.gradle\.kts"\)\s*$/m.test(code)) {
    problems.push("android/app/build.gradle does not apply sentry.gradle.kts — Release builds would upload no source map");
  }
  if (code.includes("shouldSentryAutoUploadGeneral")) {
    problems.push(
      "android/app/build.gradle overrides shouldSentryAutoUploadGeneral — the plugin was given disableAutoUpload; " +
        "whether a build uploads is decided per build by scripts/release-build.sh",
    );
  }
  return problems;
}

/** Problems with one platform's sentry.properties text (`null` = file missing). */
export function propertiesProblems(platform, text) {
  if (text === null) return [`${platform}/sentry.properties is missing — the Sentry plugin did not run`];
  if (/^\s*auth\.token\s*=/m.test(text)) {
    return [
      `${platform}/sentry.properties contains auth.token — the upload token belongs in the build ` +
        "process environment only (scripts/release-build.sh via GoGo-Infra exec-with.sh)",
    ];
  }
  if (!/^defaults\.org=gogo-vn$/m.test(text) || !/^defaults\.project=gogo-mobile$/m.test(text)) {
    return [`${platform}/sentry.properties does not name gogo-vn/gogo-mobile`];
  }
  return [];
}

const read = (file) => (existsSync(file) ? readFileSync(file, "utf8") : null);

/** Every problem for one platform of the project at `root`. */
export function sentryNativeProblems(root, platform) {
  const dir = path.join(root, platform);
  const problems = propertiesProblems(platform, read(path.join(dir, "sentry.properties")));
  if (platform === "ios") {
    const pbxproj = existsSync(dir)
      ? readdirSync(dir)
          .filter((name) => name.endsWith(".xcodeproj"))
          .map((name) => path.join(dir, name, "project.pbxproj"))
          .find(existsSync)
      : undefined;
    if (!pbxproj) problems.push("ios/<app>.xcodeproj/project.pbxproj not found");
    else problems.push(...iosProblems(readFileSync(pbxproj, "utf8")));
  } else {
    const gradle = read(path.join(dir, "app", "build.gradle"));
    if (gradle === null) problems.push("android/app/build.gradle not found");
    else problems.push(...androidProblems(gradle));
  }
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [root, platform] = process.argv.slice(2);
  if (!root || !["ios", "android"].includes(platform)) {
    console.error("usage: node scripts/lib/sentry-native.mjs <root> <ios|android>");
    process.exit(2);
  }
  const problems = sentryNativeProblems(root, platform);
  for (const problem of problems) console.error(problem);
  process.exit(problems.length > 0 ? 1 : 0);
}
