#!/usr/bin/env node
/**
 * GoGo-MobileApp#340, ADR-0011 D-5 phase 2 — is the generated native project
 * actually wired to upload to Sentry?
 *
 * `@sentry/react-native/expo` (8.30.0) writes four things at prebuild. A native
 * project missing any of them builds green and uploads nothing, so a marker
 * anywhere in the file is not enough: each check looks at the one place the
 * build executes.
 *
 *   iOS      the "Bundle React Native code and images" phase's shellScript runs
 *            sentry-xcode.sh (source map); an "Upload Debug Symbols to Sentry"
 *            phase whose shellScript runs sentry-xcode-debug-files.sh (dSYMs) and
 *            that the target lists in its buildPhases.
 *   Android  an uncommented `apply from: … "sentry.gradle.kts")` in app/build.gradle.
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

/** One PBX object's body, by the comment Xcode writes after its id. */
function pbxObject(project, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(
    `^\\t\\t[0-9A-F]{24} /\\* ${escaped} \\*/ = \\{\\n([\\s\\S]*?)^\\t\\t\\};`,
    "m",
  ).exec(project);
  return match ? match[1] : null;
}

function shellScript(body) {
  const match = /^\t\t\tshellScript = (".*");$/m.exec(body ?? "");
  return match ? JSON.parse(match[1]) : null;
}

/** Problems with the iOS project text; `[]` when it uploads both artifacts. */
export function iosProblems(project) {
  const problems = [];
  const bundle = shellScript(pbxObject(project, "Bundle React Native code and images"));
  if (bundle === null) {
    problems.push("the Xcode project has no 'Bundle React Native code and images' phase");
  } else if (!bundle.includes("/scripts/sentry-xcode.sh")) {
    problems.push(
      "the Xcode 'Bundle React Native code and images' phase does not run sentry-xcode.sh — " +
        "Release builds would upload no source map",
    );
  }
  const symbols = shellScript(pbxObject(project, "Upload Debug Symbols to Sentry"));
  if (symbols === null) {
    problems.push(
      "the Xcode project has no 'Upload Debug Symbols to Sentry' phase — native crashes would stay unsymbolicated",
    );
  } else if (!symbols.includes("/scripts/sentry-xcode-debug-files.sh")) {
    problems.push("the 'Upload Debug Symbols to Sentry' phase does not run sentry-xcode-debug-files.sh");
  } else if (!/^\t\t\t\t[0-9A-F]{24} \/\* Upload Debug Symbols to Sentry \*\/,$/m.test(project)) {
    problems.push("the 'Upload Debug Symbols to Sentry' phase exists but no target runs it (not in buildPhases)");
  }
  return problems;
}

/** Problems with android/app/build.gradle text. */
export function androidProblems(appGradle) {
  return /^apply from: .*"sentry\.gradle\.kts"\)\s*$/m.test(appGradle)
    ? []
    : ["android/app/build.gradle does not apply sentry.gradle.kts — Release builds would upload no source map"];
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
