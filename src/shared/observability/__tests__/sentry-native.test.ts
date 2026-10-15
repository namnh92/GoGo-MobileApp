import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { APPLY_SENTRY_GRADLE, pbxproj, SENTRY_PROPERTIES, writeNativeProject } from './sentry-native-fixture'

/**
 * GoGo-MobileApp#340 — `scripts/lib/sentry-native.mjs` decides whether a
 * generated native project uploads to Sentry (CI via check:native, and
 * release-build.sh before a build that has a token). A marker anywhere in the
 * file is not wiring: each case below keeps the marker text somewhere and breaks
 * the place the build actually executes.
 */

const ROOT = path.resolve(__dirname, '../../../..')
const CHECK = path.join(ROOT, 'scripts/lib/sentry-native.mjs')

let root: string
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'sentry-native-'))
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

function check(platform: 'ios' | 'android') {
  const result = spawnSync(process.execPath, [CHECK, root, platform], { encoding: 'utf8' })
  return { status: result.status, stderr: result.stderr }
}

describe('scripts/lib/sentry-native.mjs', () => {
  it.each(['ios', 'android'] as const)('%s: the generated shape passes', platform => {
    writeNativeProject(root)
    expect(check(platform)).toEqual({ status: 0, stderr: '' })
  })

  it('the real prebuild of this branch passes, when present', () => {
    // Fixture drift guard: same check against what the plugin wrote here.
    try {
      readFileSync(path.join(ROOT, 'ios/sentry.properties'))
    } catch {
      return
    }
    for (const platform of ['ios', 'android'] as const) {
      const result = spawnSync(process.execPath, [CHECK, ROOT, platform], { encoding: 'utf8' })
      expect(result.status, result.stderr).toBe(0)
    }
  })

  it.each([
    [
      'bundle phase without sentry-xcode.sh (marker only in a comment elsewhere)',
      pbxproj({ bundleScript: 'react-native-xcode.sh' }) + '\n/* sentry-xcode.sh */\n',
      /does not run sentry-xcode\.sh/,
    ],
    ['no Upload Debug Symbols phase', pbxproj({ symbolsScript: null }), /no 'Upload Debug Symbols to Sentry' phase/],
    ['dSYM phase with an empty script', pbxproj({ symbolsScript: '' }), /does not run sentry-xcode-debug-files\.sh/],
    [
      'dSYM phase that no target runs',
      pbxproj({ symbolsInTarget: false }),
      /no target runs it/,
    ],
  ])('ios: %s fails', (_name, project, expected) => {
    writeNativeProject(root, { pbxproj: project })
    const result = check('ios')
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(expected)
  })

  it.each([
    ['legacy sentry.gradle', APPLY_SENTRY_GRADLE.replace('"sentry.gradle.kts"', '"sentry.gradle"')],
    ['commented-out apply', `// ${APPLY_SENTRY_GRADLE}`],
    ['marker in a string only', `def note = "sentry.gradle.kts"\nandroid {}`],
  ])('android: %s fails', (_name, gradle) => {
    writeNativeProject(root, { appGradle: gradle })
    const result = check('android')
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/does not apply sentry\.gradle\.kts/)
  })

  it.each([
    ['auth.token present', `${SENTRY_PROPERTIES}\nauth.token=sntrys_x`, /contains auth\.token/],
    ['other project', SENTRY_PROPERTIES.replace('gogo-mobile', 'gogo-cms'), /does not name gogo-vn\/gogo-mobile/],
    ['missing file', null, /sentry\.properties is missing/],
  ])('properties: %s fails', (_name, text, expected) => {
    writeNativeProject(root, { androidProperties: text })
    const result = check('android')
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(expected)
  })
})
