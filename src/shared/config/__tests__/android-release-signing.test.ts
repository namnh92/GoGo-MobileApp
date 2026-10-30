import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { addReleaseSigning, MARKER } = require('../../../../plugins/with-android-release-signing.js')

// GoGo-MobileApp#391 — the Firebase lane's APK is signed with the
// environment's keystore, read from the environment at Gradle time.
describe('Android release signing prebuild', () => {
  const input = `android {
    buildTypes {
        release {
            signingConfig signingConfigs.debug
        }
    }
}
`

  it('adds a release signing config that reads every value from the environment', () => {
    const output = addReleaseSigning(input)
    expect(output.startsWith(input.trimEnd())).toBe(true)
    expect(output).toContain(MARKER)
    expect(output).toContain("System.getenv('GOGO_ANDROID_KEYSTORE_FILE')")
    for (const name of ['ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD']) {
      expect(output).toContain(`System.getenv('${name}')`)
    }
    expect(output).toContain('buildTypes.release.signingConfig signingConfigs.gogoRelease')
  })

  it('changes nothing unless the lane sets the keystore file', () => {
    // The override sits inside the `if`, so a build without the variable keeps
    // Expo's debug-signed release (expo run:android, release-build.sh).
    const block = addReleaseSigning(input).slice(input.trimEnd().length)
    const guard = block.indexOf('if (gogoKeystoreFile) {')
    expect(guard).toBeGreaterThan(-1)
    expect(block.indexOf('buildTypes.release.signingConfig')).toBeGreaterThan(guard)
  })

  it('never writes a secret value into the generated project', () => {
    const output = addReleaseSigning(input)
    expect(output).not.toMatch(/storePassword\s+['"]/)
    expect(output).not.toMatch(/keyPassword\s+['"]/)
  })

  it('is stable across repeated prebuilds', () => {
    const once = addReleaseSigning(input)
    expect(addReleaseSigning(once)).toBe(once)
  })

  it('fails prebuild when the template has no android block', () => {
    expect(() => addReleaseSigning('dependencies {}')).toThrow(/android block/)
  })
})
