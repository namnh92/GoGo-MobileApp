import { spawnSync } from 'node:child_process'
import { chmodSync, cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

/**
 * GoGo-MobileApp#340, ADR-0011 D-5 phase 2 — `scripts/release-build.sh` is the
 * one place that decides whether a release build uploads to Sentry. Two states
 * only: token present → upload, and a failed upload fails the build; token
 * absent → SENTRY_DISABLE_AUTO_UPLOAD=true and a warning. Everything in between
 * is refused before `expo` starts.
 *
 * `npx` is a stub on PATH that records its arguments and the Sentry variables
 * it was started with, so no build runs.
 */

const ROOT = path.resolve(__dirname, '../../../..')
const TOKEN = 'stub-upload-token-0123456789'

let sandbox: string
let project: string

beforeEach(() => {
  sandbox = mkdtempSync(path.join(tmpdir(), 'release-build-'))
  project = path.join(sandbox, 'app')
  mkdirSync(path.join(project, 'scripts'), { recursive: true })
  cpSync(path.join(ROOT, 'scripts/release-build.sh'), path.join(project, 'scripts/release-build.sh'))
  const bin = path.join(sandbox, 'bin')
  mkdirSync(bin)
  writeFileSync(
    path.join(bin, 'npx'),
    [
      '#!/usr/bin/env bash',
      'echo "args=$*" > "$RECORD"',
      'echo "disable=${SENTRY_DISABLE_AUTO_UPLOAD:-}" >> "$RECORD"',
      'echo "token=${SENTRY_AUTH_TOKEN:+set}" >> "$RECORD"',
      '',
    ].join('\n'),
  )
  chmodSync(path.join(bin, 'npx'), 0o755)
})

afterEach(() => rmSync(sandbox, { recursive: true, force: true }))

function run(args: string[], env: Record<string, string | undefined> = {}) {
  const record = path.join(sandbox, 'record')
  const base = { ...process.env }
  for (const name of ['SENTRY_AUTH_TOKEN', 'SENTRY_DISABLE_AUTO_UPLOAD', 'SENTRY_ALLOW_FAILURE']) delete base[name]
  const result = spawnSync('bash', [path.join(project, 'scripts/release-build.sh'), ...args], {
    env: { ...base, PATH: `${path.join(sandbox, 'bin')}:${process.env.PATH}`, RECORD: record, ...env },
    encoding: 'utf8',
  })
  let recorded = ''
  try {
    recorded = readFileSync(record, 'utf8')
  } catch {
    recorded = ''
  }
  return { status: result.status, stderr: result.stderr, stdout: result.stdout, recorded }
}

function nativeProjects({ withSentry }: { withSentry: boolean }) {
  mkdirSync(path.join(project, 'ios/GoGoDev.xcodeproj'), { recursive: true })
  writeFileSync(
    path.join(project, 'ios/GoGoDev.xcodeproj/project.pbxproj'),
    withSentry ? 'shellScript = "... @sentry/react-native/scripts/sentry-xcode.sh ...";' : 'shellScript = "react-native-xcode.sh";',
  )
  mkdirSync(path.join(project, 'android/app'), { recursive: true })
  writeFileSync(
    path.join(project, 'android/app/build.gradle'),
    withSentry ? 'apply from: new File(["node", "--print", "..."].execute().text.trim(), "sentry.gradle")' : 'android {}',
  )
}

describe('scripts/release-build.sh', () => {
  it.each([
    ['ios', 'args=expo run:ios --configuration Release --device 0000'],
    ['android', 'args=expo run:android --variant release --device 0000'],
  ])('%s with a token builds Release and leaves upload on', (platform, args) => {
    nativeProjects({ withSentry: true })
    const result = run([platform, '--device', '0000'], { SENTRY_AUTH_TOKEN: TOKEN })
    expect(result.status).toBe(0)
    expect(result.recorded).toBe(`${args}\ndisable=\ntoken=set\n`)
    expect(result.stdout + result.stderr).not.toContain(TOKEN)
  })

  it.each(['ios', 'android'])('%s without a token builds, skips upload and says so', platform => {
    const result = run([platform])
    expect(result.status).toBe(0)
    expect(result.recorded).toContain('disable=true\ntoken=\n')
    expect(result.stderr).toMatch(/no SENTRY_AUTH_TOKEN — this release build will not be symbolicated/)
  })

  it.each([
    ['no platform', [], {}],
    ['an unknown platform', ['web'], {}],
    ['a configuration override', ['ios', '--configuration', 'Debug'], {}],
    ['a variant override', ['android', '--variant=debug'], {}],
    ['SENTRY_ALLOW_FAILURE', ['ios'], { SENTRY_AUTH_TOKEN: TOKEN, SENTRY_ALLOW_FAILURE: 'true' }],
    ['a token with upload disabled', ['ios'], { SENTRY_AUTH_TOKEN: TOKEN, SENTRY_DISABLE_AUTO_UPLOAD: 'true' }],
  ] as const)('refuses %s before expo starts', (_name, args, env) => {
    const result = run([...args], env)
    expect(result.status).not.toBe(0)
    expect(result.recorded).toBe('')
  })

  it('refuses when .env.sentry-build-plugin exists', () => {
    writeFileSync(path.join(project, '.env.sentry-build-plugin'), 'SENTRY_AUTH_TOKEN=x\n')
    const result = run(['ios'], { SENTRY_AUTH_TOKEN: TOKEN })
    expect(result.status).not.toBe(0)
    expect(result.recorded).toBe('')
  })

  it.each(['ios', 'android'])('%s refuses a native project generated before the plugin', platform => {
    nativeProjects({ withSentry: false })
    const result = run([platform], { SENTRY_AUTH_TOKEN: TOKEN })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/predates the Sentry plugin/)
    expect(result.recorded).toBe('')
  })
})
