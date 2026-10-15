import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/**
 * A native project in the shape `@sentry/react-native/expo` 8.30.0 generates
 * (taken from a real `expo prebuild` of this app, trimmed to the parts the
 * Sentry checks read). Each `Partial` field replaces one file's text, so a test
 * states exactly which piece it breaks.
 */

const BUNDLE_SCRIPT =
  'if [[ -f \\"$PODS_ROOT/../.xcode.env\\" ]]; then\\n  source \\"$PODS_ROOT/../.xcode.env\\"\\nfi\\n' +
  '/bin/sh `\\"$NODE_BINARY\\" --print \\"require(\'path\').dirname(require.resolve(\'@sentry/react-native/package.json\')) + \'/scripts/sentry-xcode.sh\'\\"` `\\"$NODE_BINARY\\" --print \\"require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'\\"`\\n'

const SYMBOLS_SCRIPT =
  '/bin/sh \\"`${NODE_BINARY:-node} --print \\"require(\'path\').dirname(require.resolve(\'@sentry/react-native/package.json\')) + \'/scripts/sentry-xcode-debug-files.sh\'\\"`\\"'

export function pbxproj({
  bundleScript = BUNDLE_SCRIPT,
  symbolsScript = SYMBOLS_SCRIPT as string | null,
  symbolsInTarget = true,
} = {}): string {
  return [
    '// !$*UTF8*$!',
    '{',
    '\tobjects = {',
    '\t\t13B07F861A680F5B00A75B9A /* GoGoDev */ = {',
    '\t\t\tisa = PBXNativeTarget;',
    '\t\t\tbuildPhases = (',
    '\t\t\t\t00DD1BFF1BD5951E006B06BC /* Bundle React Native code and images */,',
    ...(symbolsScript !== null && symbolsInTarget ? ['\t\t\t\t83BA35611DB044ABA3C5EDCD /* Upload Debug Symbols to Sentry */,'] : []),
    '\t\t\t);',
    '\t\t};',
    '\t\t00DD1BFF1BD5951E006B06BC /* Bundle React Native code and images */ = {',
    '\t\t\tisa = PBXShellScriptBuildPhase;',
    '\t\t\tname = "Bundle React Native code and images";',
    '\t\t\tshellPath = /bin/sh;',
    `\t\t\tshellScript = "${bundleScript}";`,
    '\t\t};',
    ...(symbolsScript !== null
      ? [
          '\t\t83BA35611DB044ABA3C5EDCD /* Upload Debug Symbols to Sentry */ = {',
          '\t\t\tisa = PBXShellScriptBuildPhase;',
          '\t\t\tname = "Upload Debug Symbols to Sentry";',
          '\t\t\tshellPath = /bin/sh;',
          `\t\t\tshellScript = "${symbolsScript}";`,
          '\t\t};',
        ]
      : []),
    '\t};',
    '}',
    '',
  ].join('\n')
}

export const APPLY_SENTRY_GRADLE =
  'apply from: new File(["node", "--print", "require(\'path\').dirname(require.resolve(\'@sentry/react-native/package.json\'))"].execute(null, rootDir).text.trim(), "sentry.gradle.kts")'

export const SENTRY_PROPERTIES =
  'defaults.url=https://sentry.io/\ndefaults.org=gogo-vn\ndefaults.project=gogo-mobile\n# Using SENTRY_AUTH_TOKEN environment variable'

export function writeNativeProject(
  root: string,
  files: Partial<{ pbxproj: string; appGradle: string; iosProperties: string | null; androidProperties: string | null }> = {},
) {
  mkdirSync(path.join(root, 'ios/GoGoDev.xcodeproj'), { recursive: true })
  writeFileSync(path.join(root, 'ios/GoGoDev.xcodeproj/project.pbxproj'), files.pbxproj ?? pbxproj())
  mkdirSync(path.join(root, 'android/app'), { recursive: true })
  writeFileSync(
    path.join(root, 'android/app/build.gradle'),
    files.appGradle ?? `def jscFlavor = 'x'\n\n${APPLY_SENTRY_GRADLE}\n\nandroid {\n}\n`,
  )
  const ios = files.iosProperties === undefined ? SENTRY_PROPERTIES : files.iosProperties
  const android = files.androidProperties === undefined ? SENTRY_PROPERTIES : files.androidProperties
  if (ios !== null) writeFileSync(path.join(root, 'ios/sentry.properties'), ios)
  if (android !== null) writeFileSync(path.join(root, 'android/sentry.properties'), android)
}
