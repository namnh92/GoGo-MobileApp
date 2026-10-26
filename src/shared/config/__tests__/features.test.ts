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
