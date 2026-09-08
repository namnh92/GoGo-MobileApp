import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { addDependencies } = require('../../../../plugins/with-tenjin-android.js')

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
})
