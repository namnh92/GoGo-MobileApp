import oracle from '../__fixtures__/redaction-cases.v2.json'

/**
 * GoGo-Infra ADR-0011 oracle v2, vendored verbatim (sha256 pinned in
 * `docs/adr/0010-crash-reporting-sentry.md`). A row this client cannot pass is
 * a change to the ADR, never a local exception or a skipped row.
 */

export type Construct =
  | { kind: 'repeat'; unit: string; size: number; prefix?: string; suffix?: string }
  | { kind: 'nest'; depth: number; leaf: unknown }
  | { kind: 'cycle' }

export interface OracleCase {
  id: string
  surface: 'text' | 'deep' | 'request' | 'breadcrumb' | 'user' | 'filter' | 'init' | 'perf'
  input?: unknown
  construct?: Construct
  expected: unknown
  boundMs?: { ci: number; local: number }
  platforms?: string[]
  note?: string
}

export const ORACLE = oracle as unknown as { version: number; literal: string; cases: OracleCase[] }

/** Rows this client runs: untagged rows and rows tagged for `mobile`. */
export const MOBILE_CASES = ORACLE.cases.filter(c => !c.platforms || c.platforms.includes('mobile'))

export function casesFor(surface: OracleCase['surface']): OracleCase[] {
  return MOBILE_CASES.filter(c => c.surface === surface)
}

/** The three recipes the oracle defines (shape §4); anything else is a fixture this spec does not understand. */
export function build(construct: Construct): unknown {
  switch (construct.kind) {
    case 'repeat': {
      const body = construct.unit.repeat(Math.ceil(construct.size / construct.unit.length)).slice(0, construct.size)
      return `${construct.prefix ?? ''}${body}${construct.suffix ?? ''}`
    }
    case 'nest': {
      let value: unknown = construct.leaf
      for (let i = 0; i < construct.depth; i++) value = { a: value }
      return value
    }
    case 'cycle': {
      const o: { self: unknown } = { self: null }
      o.self = o
      return o
    }
    default:
      throw new Error(`unknown construct ${JSON.stringify(construct)}`)
  }
}

export function inputOf(row: OracleCase): unknown {
  if (row.construct) return build(row.construct)
  return row.input
}
