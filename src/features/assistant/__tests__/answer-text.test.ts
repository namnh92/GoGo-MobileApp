import { describe, expect, it } from 'vitest'

import { parseAnswer, parseInline, plainAnswer } from '../answer-text'

/**
 * GoGo-MobileApp#378 — the reply is drawn from blocks, in the design's order:
 * a lead sentence, then a `MessageList`, with `[n]` turned into `Cite`
 * markers that match the `SourceList`.
 */
describe('assistant answer text', () => {
  it('splits a lead sentence from an ordered list, with bold first words and cites', () => {
    const blocks = parseAnswer('Everyone weighs in. Four steps:\n\n1. **Create a plan** and pick.[1]\n2. **Share** the code.[2]')
    expect(blocks).toEqual([
      { kind: 'paragraph', inlines: [{ kind: 'text', text: 'Everyone weighs in. Four steps:', bold: false }] },
      {
        kind: 'list',
        ordered: true,
        items: [
          [
            { kind: 'text', text: 'Create a plan', bold: true },
            { kind: 'text', text: ' and pick.', bold: false },
            { kind: 'cite', n: 1 },
          ],
          [
            { kind: 'text', text: 'Share', bold: true },
            { kind: 'text', text: ' the code.', bold: false },
            { kind: 'cite', n: 2 },
          ],
        ],
      },
    ])
  })

  it('keeps bullets apart from numbered steps, and joins wrapped paragraph lines', () => {
    const blocks = parseAnswer('Two ways\nto count:\n- Per person\n- Group total')
    expect(blocks[0]).toEqual({ kind: 'paragraph', inlines: [{ kind: 'text', text: 'Two ways to count:', bold: false }] })
    expect(blocks[1]).toMatchObject({ kind: 'list', ordered: false, items: [[{ text: 'Per person' }], [{ text: 'Group total' }]] })
  })

  it('leaves half-streamed markup as typed rather than guessing', () => {
    expect(parseInline('With **Per per')).toEqual([{ kind: 'text', text: 'With **Per per', bold: false }])
    expect(parseAnswer('')).toEqual([])
  })

  it('reads aloud without markers or asterisks', () => {
    expect(plainAnswer('**Open** until 23:30.[1]  Closed Mondays.[2]')).toBe('Open until 23:30. Closed Mondays.')
  })
})
