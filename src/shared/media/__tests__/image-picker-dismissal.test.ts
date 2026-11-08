import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Compile the installed delegate, rather than a JS model of the native race.
// macOS (the iOS build host) has Swift via Xcode; other test hosts skip this
// native-only suite and still run the account component regressions.
describe.skipIf(process.platform !== 'darwin')('iOS picker dismissal sequencing', () => {
  let directory: string
  let binary: string

  beforeAll(() => {
    directory = mkdtempSync(path.join(tmpdir(), 'image-picker-dismissal-'))
    binary = path.join(directory, 'test-picker')
    const delegate = readFileSync(path.resolve('node_modules/expo-image-picker/ios/ImagePickerHandler.swift'), 'utf8')
    const platform = readFileSync(path.join(__dirname, 'fixtures/image-picker-platform.swift'), 'utf8')
    const scenarios = readFileSync(path.join(__dirname, 'fixtures/image-picker-dismissal.swift'), 'utf8')
    const source = path.join(directory, 'main.swift')
    writeFileSync(source, [platform, delegate.replace('import PhotosUI', ''), scenarios].join('\n'))
    const build = spawnSync('swiftc', ['-module-cache-path', path.join(directory, 'cache'), source, '-o', binary], { encoding: 'utf8' })
    expect(build.stderr, 'Swift delegate harness must compile').toBe('')
    expect(build.status).toBe(0)
  }, 60_000)

  afterAll(() => { if (directory) rmSync(directory, { recursive: true, force: true }) })

  it.each(['library', 'repeat-library', 'camera', 'cancel-library', 'cancel-camera', 'interactive-cancel'])(
    '%s delivers its result only after confirmed dismissal', scenario => {
      const run = spawnSync(binary, [scenario], { encoding: 'utf8' })
      expect(run.stdout + run.stderr).toBe(`PASS: ${scenario}\n`)
      expect(run.status).toBe(0)
    },
  )
})
