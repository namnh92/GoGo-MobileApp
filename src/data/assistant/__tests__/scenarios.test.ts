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

describe('citations match their sources', () => {
  const names = ['answer', 'places', 'long', 'drop', 'truncated'] as const
  for (const name of names) {
    for (const locale of ['vi', 'en'] as const) {
      it(`${name} (${locale}): every [n] in the text has a source numbered n`, () => {
        const { steps } = script(name, locale, new Date('2026-10-27T08:00:00Z'), 'p1')
        const text = steps
          .map(step => step.event)
          .filter((event): event is Extract<typeof event, { type: 'delta' }> => event.type === 'delta')
          .map(event => event.text)
          .join('')
        const sources = steps.flatMap(step => (step.event.type === 'sources' ? step.event.sources : []))
        const cited = [...text.matchAll(/\[(\d{1,2})\]/g)].map(match => Number(match[1]))
        const numbered = new Set(sources.map(source => source.index))
        for (const n of cited) expect(numbered.has(n)).toBe(true)
      })
    }
  }
})
