import * as Sdk from '@sentry/react-native'
import type { Breadcrumb, ErrorEvent } from '@sentry/react-native'

import { ApiError, NetworkError, TimeoutError } from '@/shared/api/errors'

import {
  beforeBreadcrumb,
  beforeSend,
  captureError,
  initSentry,
  rebuildRequest,
  rebuildUser,
  redactDeep,
  redactText,
  resetSentryForTests,
  sentryEnvironment,
  setSentryUser,
  wrapRoot,
} from '../sentry'
import { MOBILE_CASES, ORACLE, casesFor, inputOf, type OracleCase } from './oracle'

/**
 * GoGo-MobileApp#336 — every row of the ADR-0011 oracle that applies to this
 * client, dispatched by `surface`. The rows are the requirement; this file
 * only knows how to feed them in.
 */

const sdk = Sdk as unknown as { init: jest.Mock; captureException: jest.Mock; setUser: jest.Mock; wrap: jest.Mock }

beforeEach(() => {
  resetSentryForTests()
  jest.clearAllMocks()
})

describe('oracle v1', () => {
  it('is the vendored v1 and every row is accounted for', () => {
    expect(ORACLE.version).toBe(1)
    expect(ORACLE.literal).toBe('[redacted]')
    expect(ORACLE.cases).toHaveLength(116)
    // The only rows this client does not run are the ones tagged for the CMS
    // alone; a new platform tag must be read before it can be skipped.
    const skipped = ORACLE.cases.filter(c => !MOBILE_CASES.includes(c)).map(c => c.id)
    expect(skipped).toEqual(['C-14.5', 'C-14.6'])
    const surfaces = new Set(['text', 'deep', 'request', 'breadcrumb', 'user', 'filter', 'init', 'perf'])
    for (const row of ORACLE.cases) expect(surfaces.has(row.surface)).toBe(true)
  })
})

describe('text', () => {
  it.each(casesFor('text').map(c => [c.id, c] as const))('%s', (_id, row) => {
    expect(redactText(row.input as string)).toBe(row.expected)
  })
})

describe('deep', () => {
  it.each(casesFor('deep').map(c => [c.id, c] as const))('%s', (_id, row) => {
    expect(redactDeep(inputOf(row))).toEqual(row.expected)
  })
})

describe('request', () => {
  it.each(casesFor('request').map(c => [c.id, c] as const))('%s', (_id, row) => {
    expect(rebuildRequest(row.input as Parameters<typeof rebuildRequest>[0])).toEqual(row.expected)
  })

  it('reaches the event through beforeSend, header values untouched', () => {
    const row = casesFor('request').find(c => c.id === 'C-8')!
    const out = beforeSend({ type: undefined, request: row.input } as unknown as ErrorEvent, {})
    expect(out?.request).toEqual(row.expected)
  })
})

describe('breadcrumb', () => {
  it.each(casesFor('breadcrumb').map(c => [c.id, c] as const))('%s', (_id, row) => {
    expect(beforeBreadcrumb(row.input as Breadcrumb)).toEqual(row.expected)
  })

  // Native breadcrumbs are merged into a JS event by the SDK after
  // `beforeBreadcrumb` has run, so the event-level rebuild is what sees them.
  it.each(casesFor('breadcrumb').map(c => [c.id, c] as const))('%s inside an event', (_id, row) => {
    const out = beforeSend({ type: undefined, breadcrumbs: [row.input] } as unknown as ErrorEvent, {})
    expect(out?.breadcrumbs).toEqual(row.expected === null ? [] : [row.expected])
  })
})

describe('user', () => {
  it.each(casesFor('user').map(c => [c.id, c] as const))('%s', (_id, row) => {
    expect(rebuildUser(row.input as Parameters<typeof rebuildUser>[0])).toEqual(row.expected)
    const event = { type: undefined, ...(row.input ? { user: row.input } : {}) } as unknown as ErrorEvent
    const out = beforeSend(event, {})
    if (row.expected === null) expect(out).not.toHaveProperty('user')
    else expect(out?.user).toEqual(row.expected)
  })
})

/** An error whose `name` is set the way our constructors set it; `minifiedClass` renames the class, not the name. */
function errorFor(input: { name: string; message?: string; minifiedClass?: string }): Error {
  if (input.minifiedClass) {
    class Minified extends Error {}
    // What a minifier does to the class; the `name` our constructor sets stays.
    Object.defineProperty(Minified, 'name', { value: input.minifiedClass })
    const error = new Minified(input.message ?? 'x')
    error.name = input.name
    expect(error.constructor.name).toBe(input.minifiedClass)
    return error
  }
  const error = new Error(input.message ?? 'x')
  error.name = input.name
  return error
}

describe('filter', () => {
  it.each(casesFor('filter').map(c => [c.id, c] as const))('%s', (_id, row) => {
    const input = row.input as { name: string; message?: string; minifiedClass?: string; domException?: boolean }
    expect(input.domException).toBeUndefined()
    const error = errorFor(input)
    const event = { type: undefined, exception: { values: [{ type: input.name, value: error.message }] } } as unknown as ErrorEvent
    const viaHint = beforeSend(event, { originalException: error })
    const viaType = beforeSend(event, {})
    if (row.expected === 'drop') {
      expect(viaHint).toBeNull()
      expect(viaType).toBeNull()
    } else {
      expect(row.expected).toBe('keep')
      expect(viaHint).not.toBeNull()
      expect(viaType).not.toBeNull()
    }
  })

  it('drops the API client classes themselves', () => {
    const errors = [
      new ApiError(404, { code: 'NOT_FOUND', message: 'm' }),
      new NetworkError(),
      new TimeoutError(1000),
    ]
    for (const error of errors) {
      expect(beforeSend({ type: undefined } as ErrorEvent, { originalException: error })).toBeNull()
    }
  })

  it('judges by the thrown error, not by a cause further down the chain', () => {
    const event = {
      type: undefined,
      exception: { values: [{ type: 'NetworkError' }, { type: 'TypeError' }] },
    } as unknown as ErrorEvent
    expect(beforeSend(event, {})).not.toBeNull()
  })
})

const INIT_KEYS = new Set([
  'init',
  'initCalls',
  'sendDefaultPii',
  'tracesSampleRate',
  'captureErrorCallsSdk',
  'setSentryUserCallsSdk',
  'helpersThrow',
  'throws',
])

describe('init', () => {
  it.each(casesFor('init').map(c => [c.id, c] as const))('%s', (_id, row: OracleCase) => {
    const { dsn } = row.input as { dsn: string }
    const expected = row.expected as Record<string, unknown>
    for (const key of Object.keys(expected)) expect(INIT_KEYS.has(key)).toBe(true)

    if (expected.throws === true) {
      expect(() => initSentry({ dsn, environment: 'dev' })).toThrow('Invalid SENTRY DSN')
      expect(sdk.init).not.toHaveBeenCalled()
      return
    }

    initSentry({ dsn, environment: 'dev' })
    if (expected.init === false) expect(sdk.init).not.toHaveBeenCalled()
    if (expected.init === true) expect(sdk.init).toHaveBeenCalled()
    if (expected.initCalls !== undefined) expect(sdk.init).toHaveBeenCalledTimes(expected.initCalls as number)
    if (expected.sendDefaultPii !== undefined) {
      expect(sdk.init.mock.calls[0][0].sendDefaultPii).toBe(expected.sendDefaultPii)
    }
    if (expected.tracesSampleRate === 'absent') {
      expect(sdk.init.mock.calls[0][0]).not.toHaveProperty('tracesSampleRate')
      expect(sdk.init.mock.calls[0][0]).not.toHaveProperty('tracesSampler')
    }

    const helpers = () => {
      captureError(new Error('x'), { kind: 'boundary' })
      setSentryUser('u1')
      setSentryUser(null)
    }
    if (expected.helpersThrow === false) expect(helpers).not.toThrow()
    else helpers()
    if (expected.captureErrorCallsSdk === false) expect(sdk.captureException).not.toHaveBeenCalled()
    if (expected.setSentryUserCallsSdk === false) expect(sdk.setUser).not.toHaveBeenCalled()
  })

  it('with a DSN, sets the scope ADR-0011 D-1 allows and nothing more', () => {
    initSentry({ dsn: 'https://0123456789abcdef0123456789abcdef@o0.ingest.us.sentry.io/1', environment: 'staging' })
    const options = sdk.init.mock.calls[0][0]
    expect(options).toMatchObject({
      environment: 'staging',
      sendDefaultPii: false,
      enableAutoSessionTracking: false,
      enableAutoPerformanceTracing: false,
      attachScreenshot: false,
      attachViewHierarchy: false,
      enableNativeCrashHandling: true,
      enableNetworkBreadcrumbs: false,
      beforeSend,
      beforeBreadcrumb,
    })
    for (const key of ['tracesSampleRate', 'tracesSampler', 'profilesSampleRate', 'replaysSessionSampleRate',
      'replaysOnErrorSampleRate', 'enableCaptureFailedRequests', 'integrations', 'release', 'dist']) {
      expect(options).not.toHaveProperty(key)
    }
  })

  it('accepts the http DSN of the local acceptance relay', () => {
    expect(() => initSentry({ dsn: 'http://k@192.168.1.10:8096/1', environment: 'dev' })).not.toThrow()
  })

  it('helpers reach the SDK only once enabled, with a pseudonymous id or null', () => {
    initSentry({ dsn: 'https://k@o0.ingest.us.sentry.io/1', environment: 'dev' })
    const error = new Error('x')
    captureError(error, { kind: 'boundary' })
    expect(sdk.captureException).toHaveBeenCalledWith(error, { tags: { kind: 'boundary' } })
    setSentryUser('5f1c2a3e-1234-4abc-8def-0123456789ab')
    setSentryUser(null)
    expect(sdk.setUser.mock.calls).toEqual([[{ id: '5f1c2a3e-1234-4abc-8def-0123456789ab' }], [null]])
  })

  it('wraps the root only when enabled', () => {
    const Root = () => null
    expect(wrapRoot(Root)).toBe(Root)
    expect(sdk.wrap).not.toHaveBeenCalled()
    initSentry({ dsn: 'https://k@o0.ingest.us.sentry.io/1', environment: 'dev' })
    wrapRoot(Root)
    expect(sdk.wrap).toHaveBeenCalledWith(Root)
  })

  it('maps the flavour to the backend environment vocabulary', () => {
    expect(sentryEnvironment('dev')).toBe('dev')
    expect(sentryEnvironment('stag')).toBe('staging')
    expect(sentryEnvironment('prod')).toBe('prod')
  })
})

describe('defence in depth (C-19)', () => {
  it('a join failure message carries no invite code after redaction', () => {
    const message = 'POST https://api-dev.gogo.id.vn/v1/rooms/join failed: inviteCode=YDi_00PB1z4FSQZjpLbgdw'
    const event = {
      type: undefined,
      exception: { values: [{ type: 'Error', value: message }] },
      extra: { body: '{"inviteCode":"YDi_00PB1z4FSQZjpLbgdw"}', url: 'gogo-dev://room/YDi_00PB1z4FSQZjpLbgdw' },
    } as unknown as ErrorEvent
    const out = JSON.stringify(beforeSend(event, {}))
    expect(out).not.toContain('YDi_00PB1z4FSQZjpLbgdw')
  })

  it('an ApiError never reaches the event at all, whatever its message', () => {
    const error = new ApiError(404, { code: 'INVITE_NOT_FOUND', message: 'inviteCode YDi_00PB1z4FSQZjpLbgdw' })
    expect(beforeSend({ type: undefined } as ErrorEvent, { originalException: error })).toBeNull()
  })
})

/**
 * Beyond the oracle: defects GoGo-CMS#239's review round 1 found in the same
 * shape (F-01…F-09 there). Each row here failed on 01fc032.
 */
describe('beyond the oracle (shared-shape regressions)', () => {
  it.each([
    ['`;` ends a value', 'page=2;password=hunter', 'page=2;password=[redacted]'],
    ['`;` ends a value in a URL', 'https://x/y?page=2;token=abc', 'https://x/y?page=2;token=[redacted]'],
    ['percent-encoded keyword', '/inv%69te/ABCDEF', '/inv%69te/[redacted]'],
    ['percent-encoded keyword, encoded separators', 'gogo://%72%2FYDi_00PB1z4FSQZjpLbgdw', 'gogo://%72%2F[redacted]'],
    ['upper-case keyword', 'https://go.gogo.id.vn/R/abcdefg', 'https://go.gogo.id.vn/R/[redacted]'],
    ['WKT across lines', 'POINT(\n106.7009 10.7769)', '[redacted]'],
    ['WKT with long whitespace', `POINT${' '.repeat(20)}(106.7009 10.7769)`, '[redacted]'],
    ['WKT dimension glued to keyword', 'POINTZ(106.7009 10.7769 3)', '[redacted]'],
    ['WKT unterminated runs to end of text', 'bad POINT(106.7009\n10.7769', 'bad [redacted]'],
    ['SRID prefix with spaces', 'SRID=4326; POINT(106.7009 10.7769) ok', '[redacted] ok'],
    ['an English word is not WKT', 'points (two) and pointer(x)', 'points (two) and pointer(x)'],
  ])('%s', (_name, input, expected) => {
    expect(redactText(input)).toBe(expected)
  })

  it('redacts a long number under a container key whole', () => {
    const digits = '1'.repeat(80)
    expect(redactText(`{"point": ${digits}, "id": 1}`)).toBe('{"point": "[redacted]", "id": 1}')
  })

  it('redacts a primitive at exactly the depth limit', () => {
    let value: unknown = 'abc'
    for (let i = 0; i < 32; i++) value = { a: value }
    let out = redactDeep(value) as Record<string, unknown>
    for (let i = 0; i < 31; i++) out = out.a as Record<string, unknown>
    expect(out.a).toBe('[redacted]')
    let number: unknown = 10.7769
    for (let i = 0; i < 32; i++) number = { a: number }
    expect(JSON.stringify(redactDeep(number))).not.toContain('10.7769')
  })

  it('sends no client reports (errors only, D-1)', () => {
    initSentry({ dsn: 'https://k@o0.ingest.us.sentry.io/1', environment: 'dev' })
    expect(sdk.init.mock.calls[0][0].sendClientReports).toBe(false)
  })

  it.each([
    'https://k@o0.ingest.us.sentry.io:99999/1',
    'https://k@o0.ingest.us.sentry.io:0/1',
    'https://k@o0.ingest.us.sentry.io/abc',
    'https://k@/1',
    'https://@o0.ingest.us.sentry.io/1',
    'ftp://k@o0.ingest.us.sentry.io/1',
  ])('refuses the malformed DSN %s', dsn => {
    expect(() => initSentry({ dsn, environment: 'dev' })).toThrow('Invalid SENTRY DSN')
  })
})
