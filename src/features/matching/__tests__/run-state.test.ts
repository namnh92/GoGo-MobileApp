import { describe, expect, it } from 'vitest'

import { suggestionRunState } from '../run-state'

describe('suggestionRunState (#199)', () => {
  it('tells no run, a stale run, an empty run and a ready run apart', () => {
    expect(suggestionRunState(undefined)).toBe('none')
    expect(suggestionRunState({ run: null, candidates: [] })).toBe('none')
    expect(suggestionRunState({ run: { stale: true }, candidates: [{}] })).toBe('stale')
    expect(suggestionRunState({ run: { stale: true }, candidates: [] })).toBe('stale')
    expect(suggestionRunState({ run: { stale: false }, candidates: [] })).toBe('empty')
    expect(suggestionRunState({ run: {} })).toBe('empty')
    expect(suggestionRunState({ run: { stale: false }, candidates: [{}] })).toBe('ready')
  })
})
