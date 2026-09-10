/**
 * APP-036 (#188) — a missing key renders as its own name. The home profile
 * button announced "profile.title" to VoiceOver for months because nothing
 * failed: i18next returns the key, the screen still draws, and only a screen
 * reader user hears the difference.
 */
import { viMessages } from '@/shared/i18n/vi'
import { enMessages } from '@/shared/i18n/en'

const KEY_SHAPED = /^[a-z][a-zA-Z0-9]*\.[a-zA-Z0-9.]+$/

describe('i18n message tables', () => {
  it('has the key the home profile button asks for', () => {
    expect(viMessages['profile.title']).toBeTruthy()
    expect(enMessages['profile.title']).toBeTruthy()
  })

  it('never resolves a key to its own name', () => {
    for (const [name, table] of [
      ['vi', viMessages],
      ['en', enMessages],
    ] as const) {
      const echoed = Object.entries(table)
        .filter(([key, value]) => key === value)
        .map(([key]) => `${name}:${key}`)
      expect(echoed).toEqual([])
    }
  })

  it('carries every Vietnamese key in English too', () => {
    const missing = Object.keys(viMessages).filter(key => !(key in enMessages))
    expect(missing).toEqual([])
  })

  it('has no value that is merely a key-shaped string', () => {
    const suspicious = Object.entries(viMessages)
      .filter(([, value]) => typeof value === 'string' && KEY_SHAPED.test(value))
      .map(([key]) => key)
    expect(suspicious).toEqual([])
  })
})
