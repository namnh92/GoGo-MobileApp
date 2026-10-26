import { describe, expect, it } from 'vitest'

import { assistantEntryEnabled } from '@/shared/config/features'

/**
 * GoGo-MobileApp#379: the GoGo AI entry points ship dark until the assistant
 * API exists (GoGo-BE#713). On in dev for building and review; off in stag and
 * prod unless the build forces it on.
 */
describe('assistant entry gate (#379)', () => {
  it('follows the flavour when the build says nothing: on in dev, off in stag and prod', () => {
    expect(assistantEntryEnabled('dev', undefined)).toBe(true)
    expect(assistantEntryEnabled('stag', undefined)).toBe(false)
    expect(assistantEntryEnabled('prod', undefined)).toBe(false)
  })

  it('an explicit on/off wins over the flavour', () => {
    expect(assistantEntryEnabled('prod', 'on')).toBe(true)
    expect(assistantEntryEnabled('dev', 'off')).toBe(false)
  })
})

/**
 * GoGo-MobileApp#378: the scripted assistant answers only in a dev-flavour
 * debug build. Nothing a tester or a user installs answers from a script.
 */
describe('assistant mock gate (#378)', async () => {
  const { assistantMockEnabled } = await import('@/shared/config/features')

  it('is on by default in a dev debug build, and can be turned off', () => {
    expect(assistantMockEnabled('dev', undefined, true)).toBe(true)
    expect(assistantMockEnabled('dev', 'off', true)).toBe(false)
  })

  it('never in stag or prod, and never in a release build, whatever the variable says', () => {
    expect(assistantMockEnabled('stag', 'on', true)).toBe(false)
    expect(assistantMockEnabled('prod', 'on', true)).toBe(false)
    expect(assistantMockEnabled('dev', 'on', false)).toBe(false)
  })
})
