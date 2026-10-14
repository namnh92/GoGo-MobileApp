import { redactText } from '../sentry'
import { casesFor, inputOf } from './oracle'

/**
 * Oracle C-16 — a regression test against known expensive patterns, not a
 * proof of complexity. Each 100 kB input must finish inside its own bound:
 * the CI runner's when `CI` is set, the developer machine's otherwise. A new
 * pattern in `redactText` needs a new corpus row in the ADR's oracle.
 */
describe('redactText stays fast on adversarial input (C-16)', () => {
  const rows = casesFor('perf')

  it('has the full corpus', () => {
    expect(rows).toHaveLength(18)
  })

  it.each(rows.map(row => [row.id, row] as const))('%s', (_id, row) => {
    expect(row.expected).toBe('completes')
    const input = inputOf(row) as string
    expect(input.length).toBeGreaterThanOrEqual(100_000)
    const bound = process.env.CI ? row.boundMs!.ci : row.boundMs!.local
    const started = performance.now()
    redactText(input)
    const elapsed = performance.now() - started
    if (elapsed > bound) throw new Error(`${row.id}: ${elapsed.toFixed(0)} ms > ${bound} ms`)
  })
})
