import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { addDependencies, addLogStrip, LOG_STRIP_MARKER } = require('../../../../plugins/with-tenjin-android.js')

describe('Tenjin Android prebuild', () => {
  it('preserves existing dependencies and is stable across repeated prebuilds', () => {
    const input = `android { namespace 'max.gogo.dev' }
dependencies {
    implementation 'com.facebook.react:react-android'
}
`
    const output = addDependencies(input)
    expect(output).toContain("implementation 'com.facebook.react:react-android'")
    expect(output).toContain("android { namespace 'max.gogo.dev' }")
    for (const artifact of ['play-services-ads-identifier', 'play-services-appset', 'installreferrer:installreferrer']) {
      expect(output).toContain(artifact)
    }
    expect(addDependencies(output)).toBe(output)
  })

  it('fails prebuild when the template changes instead of shipping without identifiers', () => {
    expect(() => addDependencies('android {}')).toThrow(/dependencies block/)
  })

  // GoGo-MobileApp#402: the SDK logs connect parameters unconditionally and has no switch.
  it('adds the release-only log strip for the Tenjin SDK once', () => {
    const input = `android { namespace 'max.gogo.dev' }\ndependencies {\n}\n`
    const output = addLogStrip(input)
    expect(output.startsWith(input.trimEnd())).toBe(true)
    expect(output).toContain(LOG_STRIP_MARKER)
    expect(output).toContain("selector().withBuildType('release')")
    expect(output).toContain("startsWith('com.tenjin.android.')")
    expect(output).toContain("'android/util/Log'")
    expect(addLogStrip(output)).toBe(output)
  })

  it('fails prebuild when the template changes instead of shipping the logs', () => {
    expect(() => addLogStrip('dependencies {\n}\n')).toThrow(/android block/)
  })
})
