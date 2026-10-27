import { describe, expect, it } from 'vitest'

import { pickScenario, script } from '../scenarios'

/**
 * GoGo-MobileApp#378 follow-up (GoGo-BE#713 SA decision Q5): the dev mock can
 * reach a reply that hits the server's hard ceiling — partial text, then
 * `done{status: truncated}` — by typing "bị cắt" / "cut short".
 */
describe('the truncated scenario', () => {
  it('is picked by "bị cắt" (any accents) or "cut short"', () => {
    expect(pickScenario('Câu này bị cắt')).toBe('truncated')
    expect(pickScenario('cau nay bi cat')).toBe('truncated')
    expect(pickScenario('A reply that gets cut short')).toBe('truncated')
  })

  it.each(['vi', 'en'] as const)('%s: streams partial text and ends with done{truncated}, no error frame', locale => {
    const { steps } = script('truncated', locale, new Date('2026-10-27T03:00:00Z'), 'p')
    const events = steps.map(step => step.event)
    expect(events.some(event => event.type === 'delta')).toBe(true)
    expect(events.at(-1)).toEqual({ type: 'done', status: 'truncated' })
    expect(events.some(event => event.type === 'error')).toBe(false)
  })
})
