import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

/**
 * GoGo-MobileApp#340, ADR-0011 D-5 phase 2 — the two Xcode phase scripts
 * `@sentry/react-native` 8.30.0 installs are what "a failed upload fails the
 * build" rests on, so they run here against a fake sentry-cli with a chosen
 * exit code, the way Xcode runs them (`"$NODE_BINARY" "$SENTRY_CLI_EXECUTABLE" …`).
 *
 * Upstream, `sentry-xcode-debug-files.sh` prints `error:` on a failed dSYM
 * upload and then reaches the end of the file with status 0: the build stays
 * green and ships without native symbols. The repo patches that one script
 * (pnpm patch, `patches/@sentry__react-native@8.30.0.patch`) to exit with the
 * upload's status; the cases below pin the patched behaviour and the patch's
 * presence, so a dependency bump that drops it fails CI, not a release.
 */

const ROOT = path.resolve(__dirname, '../../../..')
const SDK_SCRIPTS = path.join(ROOT, 'node_modules/@sentry/react-native/scripts')
const DEBUG_FILES = path.join(SDK_SCRIPTS, 'sentry-xcode-debug-files.sh')
const BUNDLE = path.join(SDK_SCRIPTS, 'sentry-xcode.sh')
const PATCH = path.join(ROOT, 'patches/@sentry__react-native@8.30.0.patch')
const PATCH_LINE = 'exit "$UPLOAD_EXIT_CODE"'

let sandbox: string

beforeEach(() => {
  sandbox = mkdtempSync(path.join(tmpdir(), 'sentry-xcode-'))
  mkdirSync(path.join(sandbox, 'ios'))
  mkdirSync(path.join(sandbox, 'dSYMs'))
  // A JS file: the SDK scripts invoke the CLI through the node binary.
  writeFileSync(
    path.join(sandbox, 'sentry-cli.js'),
    [
      "const fs = require('node:fs')",
      "fs.appendFileSync(process.env.RECORD, process.argv.slice(2).join(' ') + '\\n')",
      "const ok = process.env.FAKE_EXIT === '0'",
      "console.log('fake sentry-cli: ' + (ok ? 'Uploaded 1 missing debug information file' : 'API request failed'))",
      'process.exit(Number(process.env.FAKE_EXIT))',
      '',
    ].join('\n'),
  )
})

afterEach(() => rmSync(sandbox, { recursive: true, force: true }))

function runPhase(script: string, env: Record<string, string>, args: string[] = []) {
  const record = path.join(sandbox, 'record')
  const result = spawnSync('bash', [script, ...args], {
    cwd: path.join(sandbox, 'ios'),
    // A closed environment: the scripts read every SENTRY_* they find.
    env: {
      NODE_ENV: 'test',
      PATH: process.env.PATH ?? '',
      HOME: process.env.HOME ?? '',
      NODE_BINARY: process.execPath,
      SENTRY_CLI_EXECUTABLE: path.join(sandbox, 'sentry-cli.js'),
      CONFIGURATION: 'Release',
      PROJECT_DIR: path.join(sandbox, 'ios'),
      DWARF_DSYM_FOLDER_PATH: path.join(sandbox, 'dSYMs'),
      SENTRY_DSYM_WAIT_ENABLED: 'false',
      WITH_ENVIRONMENT: '/dev/null',
      SENTRY_COLLECT_MODULES: '/dev/null',
      RECORD: record,
      FAKE_EXIT: '0',
      ...env,
    },
    encoding: 'utf8',
  })
  let recorded = ''
  try {
    recorded = readFileSync(record, 'utf8')
  } catch {
    recorded = ''
  }
  return { status: result.status, out: result.stdout + result.stderr, recorded }
}

describe('sentry-xcode-debug-files.sh (patched)', () => {
  it('the installed script, the patch file and the pnpm pin agree', () => {
    expect(readFileSync(DEBUG_FILES, 'utf8')).toContain(PATCH_LINE)
    expect(readFileSync(PATCH, 'utf8')).toContain(`+      ${PATCH_LINE}`)
    expect(readFileSync(path.join(ROOT, 'pnpm-workspace.yaml'), 'utf8')).toContain(
      "'@sentry/react-native@8.30.0': patches/@sentry__react-native@8.30.0.patch",
    )
  })

  it('fails the phase when sentry-cli fails — upstream ends with status 0 here', () => {
    const result = runPhase(DEBUG_FILES, { FAKE_EXIT: '1' })
    expect(result.status).toBe(1)
    expect(result.out).toContain('error: sentry-cli - fake sentry-cli: API request failed')
    expect(result.recorded).toMatch(/^debug-files upload .*dSYMs\n$/)
  })

  it("exits with sentry-cli's own status", () => {
    expect(runPhase(DEBUG_FILES, { FAKE_EXIT: '7' }).status).toBe(7)
  })

  it('a successful upload passes and shows the CLI output', () => {
    const result = runPhase(DEBUG_FILES, {})
    expect(result.status).toBe(0)
    expect(result.out).toContain('output: sentry-cli - fake sentry-cli: Uploaded 1 missing debug information file')
  })

  it('SENTRY_DISABLE_AUTO_UPLOAD=true skips without running sentry-cli (the no-token branch of release-build.sh)', () => {
    const result = runPhase(DEBUG_FILES, { SENTRY_DISABLE_AUTO_UPLOAD: 'true', FAKE_EXIT: '1' })
    expect(result.status).toBe(0)
    expect(result.out).toContain('SENTRY_DISABLE_AUTO_UPLOAD=true, skipping debug files upload')
    expect(result.recorded).toBe('')
  })

  it('a Debug configuration skips on its own (dev client builds need no token)', () => {
    const result = runPhase(DEBUG_FILES, { CONFIGURATION: 'Debug', FAKE_EXIT: '1' })
    expect(result.status).toBe(0)
    expect(result.recorded).toBe('')
  })

  it('SENTRY_ALLOW_FAILURE=true turns the failure into a warning — the third state release-build.sh refuses', () => {
    const result = runPhase(DEBUG_FILES, { SENTRY_ALLOW_FAILURE: 'true', FAKE_EXIT: '1' })
    expect(result.status).toBe(0)
    expect(result.out).toContain('warning: sentry-cli - Debug files upload failed, but continuing build')
  })
})

describe('sentry-xcode.sh (upstream)', () => {
  const RN_XCODE = '/never/run/react-native-xcode.sh'

  it('fails the phase when sentry-cli fails', () => {
    const result = runPhase(BUNDLE, { FAKE_EXIT: '1' }, [RN_XCODE])
    expect(result.status).toBe(1)
    expect(result.out).toContain('error: sentry-cli - fake sentry-cli: API request failed')
    expect(result.recorded).toMatch(new RegExp(`^react-native xcode .*${RN_XCODE}\\n$`))
  })

  it('a successful upload passes and shows the CLI output', () => {
    const result = runPhase(BUNDLE, {}, [RN_XCODE])
    expect(result.status).toBe(0)
    expect(result.out).toContain('output: sentry-cli - fake sentry-cli: Uploaded')
  })
})
