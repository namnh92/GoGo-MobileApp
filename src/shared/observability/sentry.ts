import * as Sentry from '@sentry/react-native'
import type { Breadcrumb, ErrorEvent } from '@sentry/react-native'
import type { ComponentType } from 'react'

import { ApiError, NetworkError, TimeoutError } from '@/shared/api/errors'

/**
 * GoGo-MobileApp#336 — the only file that touches the Sentry SDK (GoGo-Infra
 * ADR-0011, `docs/adr/0010-crash-reporting-sentry.md`). `sentry-usage.spec.ts`
 * fails when anything else imports it.
 *
 * Scope is errors and native crashes only (ADR-0011 D-1): no tracing, no
 * replay, no screenshots, no sessions, `sendDefaultPii: false`.
 *
 * Structural limits — nothing to pattern-match, so nothing to miss (D-9):
 * - `event.user` is rebuilt as `{ id }` or removed;
 * - `event.request` is rebuilt from `url`, `method`, `query_string` and the
 *   headers in {@link REQUEST_HEADERS};
 * - breadcrumbs keep only the categories in {@link rebuildBreadcrumb}, with
 *   `data` rebuilt per category — `console` and everything unnamed is dropped.
 *   Native breadcrumbs merged into a JS event by the SDK never pass
 *   `beforeBreadcrumb`, so `beforeSend` runs the same rebuild over
 *   `event.breadcrumbs`.
 *
 * Pattern limits — text an operator needs: every remaining string goes
 * through {@link redactText}, whose rule order is fixed by the oracle
 * (`__fixtures__/redaction-cases.v1.json`, vendored verbatim from GoGo-Infra).
 *
 * Every scanner here is linear in its input (oracle C-16 feeds 100 kB
 * adversarial strings), and no pattern uses lookbehind: the redactor runs on
 * Hermes in every device build, not on the V8 that runs jest.
 */

/** Not re-exported by the RN SDK; taken from the hook's own signature rather than from a transitive package. */
type EventHint = Parameters<NonNullable<NonNullable<Parameters<typeof Sentry.init>[0]>['beforeSend']>>[1]

export const REDACTED = '[redacted]'
export const REDACTED_EMAIL = '[redacted-email]'

/** BE's set (`GoGo-BE/libs/observability/src/sentry.ts`). */
export const REQUEST_HEADERS: ReadonlySet<string> = new Set([
  'accept',
  'accept-language',
  'content-length',
  'content-type',
  'user-agent',
  'x-request-id',
])

/** The API client's own errors, plus a raw fetch abort. Expected, never reported (D-10). */
const IGNORED_ERROR_NAMES: ReadonlySet<string> = new Set(['ApiError', 'NetworkError', 'TimeoutError', 'AbortError'])

// --- names -------------------------------------------------------------------

/** Compared lowercased with `_` and `-` removed, so `invite_code`, `inviteCode` and `INVITE-CODE` match alike. */
const CREDENTIAL_NAMES: ReadonlySet<string> = new Set([
  'token',
  'invitecode',
  'invite',
  'code',
  'slug',
  'refreshtoken',
  'accesstoken',
  'guesttoken',
  'key',
  'signature',
  'idempotencykey',
  'jwt',
  'assertion',
  'password',
  'email',
])

const EXACT_COORDINATE_NAME = /^(?:lat|lng|lon|latitude|longitude)$/i
/**
 * `originLat`, `homeLONGITUDE` — a capital `L` after a lowercase letter or
 * digit marks the compound, so `flat` or `plateau` never match.
 */
const CAMEL_COORDINATE_SUFFIX = /[a-z0-9]L(?:at|ng|on|atitude|ongitude|AT|NG|ON|ATITUDE|ONGITUDE)$/
/** `ORIGINLAT` — an all-capitals name has no case boundary left, so the suffix alone decides (`FLAT` is accepted loss). */
const UPPER_COORDINATE_SUFFIX = /^[A-Z0-9]*(?:LAT|LNG|LON|LATITUDE|LONGITUDE)$/
/** `origin_lat`, `Origin_Lat`. */
const SNAKE_COORDINATE_SUFFIX = /_(?:lat|lng|lon|latitude|longitude)$/i
/** Keys whose whole value is a position or a set of positions, whatever its shape (C-7). */
const COORDINATE_CONTAINER_NAME = /^(?:coordinates|bbox|bounds|viewport|latlng|ll|geom|geometry|point|origin)$/i

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[_-]/g, '')
}

function isCredentialName(name: string): boolean {
  return CREDENTIAL_NAMES.has(normalizeName(name))
}

function isCoordinateName(name: string): boolean {
  return (
    EXACT_COORDINATE_NAME.test(name) ||
    CAMEL_COORDINATE_SUFFIX.test(name) ||
    UPPER_COORDINATE_SUFFIX.test(name) ||
    SNAKE_COORDINATE_SUFFIX.test(name)
  )
}

function isContainerName(name: string): boolean {
  return COORDINATE_CONTAINER_NAME.test(name)
}

/** A key or parameter whose value never leaves the device. */
function isRedactedName(name: string): boolean {
  return isCredentialName(name) || isCoordinateName(name) || isContainerName(name)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// --- stage 1: named parameters and JSON keys ----------------------------------

/**
 * `name=value` in a URL, a bare query string, a fragment or free text. The
 * name starts at any character that cannot be part of a name (`?`, `&`, `#`,
 * `(`, `,`, whitespace…), so `error(token=abc)` and `#token=abc` are found.
 * The value stops at the next separator, whitespace, quote or closing bracket,
 * so the text around it survives and `page=2;password=x` is two parameters.
 */
const QUERY_PARAMETER = /(^|[^\w.-])([A-Za-z_][\w.-]*)=([^&#;\s"'<>()[\]{},]*)/g
/** A JSON key and its colon; the value is measured by {@link jsonValueEnd}. */
const JSON_KEY = /"([A-Za-z_]\w*)"\s*:\s*/g

function redactNamed(text: string): string {
  return redactJsonKeys(text).replace(QUERY_PARAMETER, (match, lead: string, name: string) =>
    isRedactedName(name) ? `${lead}${name}=${REDACTED}` : match,
  )
}

/**
 * `"token": "abc"`, `"lat": 10.7`, `"bounds": {…}`, `"token": ["abc"]` in JSON
 * text: for every redacted name the whole value — string, number, array or
 * object, measured by {@link jsonValueEnd} — becomes the quoted literal, so the
 * text stays JSON. `null`, `true`, `false` stay.
 */
function redactJsonKeys(text: string): string {
  let out = ''
  let last = 0
  JSON_KEY.lastIndex = 0
  for (let match = JSON_KEY.exec(text); match; match = JSON_KEY.exec(text)) {
    if (!isRedactedName(match[1] ?? '')) continue
    const start = match.index + match[0].length
    const end = jsonValueEnd(text, start)
    if (end <= start) continue
    out += `${text.slice(last, start)}"${REDACTED}"`
    last = end
    JSON_KEY.lastIndex = end
  }
  return out + text.slice(last)
}

/** Index just past the JSON value at `start`; an unterminated one runs to the end. Linear. */
function jsonValueEnd(text: string, start: number): number {
  const first = text[start]
  if (first === '[' || first === '{') {
    let depth = 0
    let inString = false
    for (let i = start; i < text.length; i++) {
      const ch = text[i]
      if (inString) {
        if (ch === '\\') i++
        else if (ch === '"') inString = false
        continue
      }
      if (ch === '"') inString = true
      else if (ch === '[' || ch === '{') depth++
      else if (ch === ']' || ch === '}') {
        depth--
        if (depth === 0) return i + 1
      }
    }
    return text.length
  }
  if (first === '"') {
    for (let i = start + 1; i < text.length; i++) {
      if (text[i] === '\\') i++
      else if (text[i] === '"') return i + 1
    }
    return text.length
  }
  return numberEnd(text, start)
}

function isDigit(ch: string | undefined): boolean {
  return ch !== undefined && ch >= '0' && ch <= '9'
}

/** End of a JSON number at `start`, scanned whole — a long one is never cut and its tail left behind. */
function numberEnd(text: string, start: number): number {
  let i = start
  if (text[i] === '-') i++
  const digits = i
  while (isDigit(text[i])) i++
  if (i === digits) return start
  if (text[i] === '.' && isDigit(text[i + 1])) {
    i++
    while (isDigit(text[i])) i++
  }
  if (text[i] === 'e' || text[i] === 'E') {
    let j = i + 1
    if (text[j] === '+' || text[j] === '-') j++
    if (isDigit(text[j])) {
      while (isDigit(text[j])) j++
      i = j
    }
  }
  return i
}

// --- stage 2: credential path segments -----------------------------------------

/** Segments whose *next* segment is a credential (`room`/`rooms`: see {@link isRoomCode}). */
const CREDENTIAL_KEYWORDS: ReadonlySet<string> = new Set(['r', 'l', 'invite', 'share-links', 'room', 'rooms'])
const ROOM_SEGMENT = /^[A-Za-z0-9_-]{6,64}$/

/** Length of the path separator at `i`: `/` → 1, `%2F` (any case) → 3, else 0. */
function separatorAt(text: string, i: number): number {
  if (text[i] === '/') return 1
  return text[i] === '%' && text[i + 1] === '2' && (text[i + 2] === 'F' || text[i + 2] === 'f') ? 3 : 0
}

function isSegmentStop(text: string, i: number): boolean {
  const ch = text[i]
  return ch === '?' || ch === '#' || ch === '&' || ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' ||
    separatorAt(text, i) > 0
}

function segmentEnd(text: string, from: number): number {
  let i = from
  while (i < text.length && !isSegmentStop(text, i)) i++
  return i
}

function percentDecode(raw: string): string {
  if (!raw.includes('%')) return raw
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function isRoomCode(segment: string): boolean {
  return ROOM_SEGMENT.test(segment) && !UUID.test(segment)
}

/**
 * One pass over the path segments. A segment equal to a keyword — compared on
 * its percent-decoded form, so `inv%69te` is `invite` — makes the next segment
 * a candidate. `r | l | invite | share-links` candidates are always
 * credentials; a `room | rooms` candidate only when it looks like a code and
 * is not a uuid (`/v1/rooms/<uuid>` is an id, C-21), judged on the raw segment
 * and its decoded form. Either way the raw span is what gets redacted (C-2c).
 */
function redactSegments(text: string): string {
  let out = ''
  let last = 0
  let i = 0
  while (i < text.length) {
    const sep = separatorAt(text, i)
    if (sep === 0) {
      i++
      continue
    }
    const keywordStart = i + sep
    const keywordEnd = segmentEnd(text, keywordStart)
    const nextSep = separatorAt(text, keywordEnd)
    if (keywordEnd > keywordStart && nextSep > 0) {
      const keyword = percentDecode(text.slice(keywordStart, keywordEnd)).toLowerCase()
      if (CREDENTIAL_KEYWORDS.has(keyword)) {
        const start = keywordEnd + nextSep
        const end = segmentEnd(text, start)
        const raw = text.slice(start, end)
        const credential = end > start &&
          (keyword === 'room' || keyword === 'rooms' ? isRoomCode(raw) || isRoomCode(percentDecode(raw)) : true)
        if (credential) {
          out += `${text.slice(last, start)}${REDACTED}`
          last = end
          i = end
          continue
        }
      }
    }
    // The separator that ends this segment starts the next one (`/r//r/x`).
    i = keywordEnd > keywordStart ? keywordEnd : keywordStart
  }
  return out + text.slice(last)
}

// --- stage 3: coordinate shapes ----------------------------------------------

/** Google Maps data parameters `!3d10.7769!4d106.7009`. */
const MAPS_DATA_POSITION = /!3d-?\d+(?:\.\d+)?!4d-?\d+(?:\.\d+)?/g
/**
 * A decimal pair with three or more decimals on both sides, split by `,` or
 * `%2C`, not inside a longer number or word. The lead is captured instead of
 * looked behind (Hermes): start of text, a non-word character, or an encoded
 * `@` (`%40`), which ends in a digit.
 */
const COORDINATE_PAIR = /(^|%40|[^\w.])-?\d{1,3}\.\d{3,}\s*(?:,|%2C)\s*-?\d{1,3}\.\d{3,}(?![\w.])/gi
/** A WKT geometry keyword; what follows (dimension, whitespace of any length, `(`) is scanned by hand. */
const WKT_KEYWORD = /\b(?:MULTI)?(?:POINT|LINESTRING|POLYGON|GEOMETRYCOLLECTION)/gi
const SRID_PREFIX = /SRID=\d{1,10};$/i

function isSpace(ch: string | undefined): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\v'
}

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && /\w/.test(ch)
}

/** Index of the `(` that opens the geometry after `from`, or -1: whitespace, optional `Z`/`M`/`ZM`, whitespace. */
function wktOpen(text: string, from: number): number {
  let j = from
  while (isSpace(text[j])) j++
  const dim = text.slice(j, j + 2).toUpperCase()
  if (dim === 'ZM' && !isWordChar(text[j + 2])) j += 2
  else if ((dim[0] === 'Z' || dim[0] === 'M') && !isWordChar(text[j + 1])) j += 1
  while (isSpace(text[j])) j++
  return text[j] === '(' ? j : -1
}

/** Index just past the `)` that closes the `(` at `open`, across lines; unterminated → end of text. Linear. */
function balancedEnd(text: string, open: number): number {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    const ch = text[i]
    if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth === 0) return i + 1
    }
  }
  return text.length
}

/**
 * The whole geometry, `SRID=…;` prefix and keyword included, whatever the
 * whitespace and line breaks inside it (`POINT(\n106.7 10.7)`). One cut off
 * before its `)` runs to the end of the text. Each character is visited a
 * bounded number of times: the scan resumes after whatever was consumed.
 */
function redactWkt(text: string): string {
  let out = ''
  let last = 0
  WKT_KEYWORD.lastIndex = 0
  for (let match = WKT_KEYWORD.exec(text); match; match = WKT_KEYWORD.exec(text)) {
    const keywordEnd = match.index + match[0].length
    const open = wktOpen(text, keywordEnd)
    if (open < 0) {
      WKT_KEYWORD.lastIndex = keywordEnd
      continue
    }
    let start = match.index
    let k = start
    while (k > last && isSpace(text[k - 1])) k--
    const prefix = SRID_PREFIX.exec(text.slice(Math.max(last, k - 17), k))
    if (prefix) start = k - prefix[0].length
    const end = balancedEnd(text, open)
    out += `${text.slice(last, start)}${REDACTED}`
    last = end
    WKT_KEYWORD.lastIndex = end
  }
  return out + text.slice(last)
}

function redactCoordinateShapes(text: string): string {
  return redactWkt(
    text
      .replace(MAPS_DATA_POSITION, REDACTED)
      .replace(COORDINATE_PAIR, (_match, lead: string) => `${lead}${REDACTED}`),
  )
}

// --- stage 4: bearer tokens and JWTs -------------------------------------------

const BEARER = /\bBearer\s+\S+/gi
/** Captured lead instead of lookbehind: a JWT starts a token run, so each run is tried once. */
const JWT = /(^|[^A-Za-z0-9_-])eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g

function redactBearer(text: string): string {
  return text
    .replace(BEARER, `Bearer ${REDACTED}`)
    .replace(JWT, (_match, lead: string) => `${lead}${REDACTED}`)
}

// --- stage 5: emails ---------------------------------------------------------

const EMAIL_LOCAL = /[A-Za-z0-9._%+-]/
const EMAIL_DOMAIN = /[A-Za-z0-9.-]/
const EMAIL_DOMAIN_SHAPE = /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/

/**
 * Scanned around each `@` rather than matched by one regex: a pattern like
 * `[local]+@` retries from every start position and is quadratic on a long
 * run with no `@`. Each character is visited a bounded number of times.
 */
function redactEmails(text: string): string {
  let out = ''
  let last = 0
  let at = text.indexOf('@')
  while (at >= 0) {
    let left = at
    while (left > last && EMAIL_LOCAL.test(text[left - 1]!)) left--
    let right = at + 1
    while (right < text.length && EMAIL_DOMAIN.test(text[right]!)) right++
    let domainEnd = right
    while (domainEnd > at + 1 && text[domainEnd - 1] === '.') domainEnd--
    if (left < at && EMAIL_DOMAIN_SHAPE.test(text.slice(at + 1, domainEnd))) {
      out += `${text.slice(last, left)}${REDACTED_EMAIL}`
      last = domainEnd
      at = text.indexOf('@', domainEnd)
    } else {
      at = text.indexOf('@', at + 1)
    }
  }
  return out + text.slice(last)
}

// --- stage 6: generic token runs ---------------------------------------------

const TOKEN_RUN = /[A-Za-z0-9_-]+/g

/** Any run of six or more with a letter and a digit, unless it is a uuid. */
function redactTokenRuns(text: string): string {
  return text.replace(TOKEN_RUN, run =>
    run.length >= 6 && /[A-Za-z]/.test(run) && /\d/.test(run) && !UUID.test(run) ? REDACTED : run,
  )
}

/** Stages run in the oracle's order, each on the previous one's output. */
export function redactText(text: string): string {
  return redactTokenRuns(redactEmails(redactBearer(redactCoordinateShapes(redactSegments(redactNamed(text))))))
}

// --- objects -------------------------------------------------------------------

const MAX_DEPTH = 32

/**
 * Copied through untouched (ADR-0011 D-9, complete set). Stack frames and
 * device models would otherwise match the token-run stage. Paths are relative
 * to the event root; `[]` means every element of an array.
 *
 * `sdkProcessingMetadata` is not in the ADR's list because it never leaves the
 * device: the SDK holds live scope objects there and strips the key before
 * the envelope is written. Walking it would turn those objects into plain data
 * the SDK still reads after `beforeSend`.
 */
const OPAQUE_PATHS: ReadonlySet<string> = new Set([
  'event_id',
  'timestamp',
  'release',
  'dist',
  'sdk',
  'platform',
  'environment',
  'level',
  'exception.values[].stacktrace',
  'exception.values[].type',
  'exception.values[].mechanism',
  'contexts.device',
  'contexts.os',
  'contexts.app',
  'contexts.react_native_context',
  'contexts.browser',
  'debug_meta',
  'modules',
  'breadcrumbs[].timestamp',
  'breadcrumbs[].level',
  'sdkProcessingMetadata',
])

/**
 * A copy of `value` with every credential and coordinate redacted: named keys,
 * container keys whatever their value, `[name, value]` tuples, and every
 * string through {@link redactText}. Cycles and anything below
 * {@link MAX_DEPTH} become the literal. Applied at the event root, the
 * opaque paths are copied as they are.
 */
export function redactDeep<T>(value: T): T {
  return walk(value, '', new Set<object>(), 0) as T
}

/** One value as it would sit at `path` of an event: named key rules first, then the walk. */
function redactAt(key: string, value: unknown, path: string): unknown {
  if (value === null || value === undefined) return value
  if (OPAQUE_PATHS.has(path)) return value
  if (isContainerName(key) || isCredentialName(key)) return REDACTED
  if (isCoordinateName(key) && typeof value !== 'object') return REDACTED
  return walk(value, path, new Set<object>(), 1)
}

function walk(value: unknown, path: string, ancestors: Set<object>, depth: number): unknown {
  if (value === null || value === undefined) return value
  // Before any leaf handling: below the limit, a primitive is as unread as an object.
  if (depth >= MAX_DEPTH) return REDACTED
  if (typeof value === 'string') return redactText(value)
  if (typeof value !== 'object') return value
  if (ancestors.has(value)) return REDACTED
  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      if (value.length === 2 && typeof value[0] === 'string' && isRedactedName(value[0])) {
        return [value[0], REDACTED]
      }
      const itemPath = `${path}[]`
      return value.map(item => walk(item, itemPath, ancestors, depth + 1))
    }
    const out: Record<string, unknown> = {}
    for (const [key, inner] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key
      if (OPAQUE_PATHS.has(childPath)) out[key] = inner
      else if (inner === null || inner === undefined) out[key] = inner
      else if (isContainerName(key) || isCredentialName(key)) out[key] = REDACTED
      else if (isCoordinateName(key) && typeof inner !== 'object') out[key] = REDACTED
      else out[key] = walk(inner, childPath, ancestors, depth + 1)
    }
    return out
  } finally {
    ancestors.delete(value)
  }
}

// --- structural rebuilds -----------------------------------------------------

type RequestLike = {
  url?: unknown
  method?: unknown
  query_string?: unknown
  headers?: Record<string, unknown>
}

/** Rebuilt from the allowlist; header values are kept as given (C-8). */
export function rebuildRequest<T extends RequestLike | null | undefined>(request: T): T {
  if (!request || typeof request !== 'object') return request
  const out: Record<string, unknown> = {}
  if (typeof request.url === 'string') out.url = redactText(request.url)
  if (request.method !== undefined) out.method = request.method
  if (request.query_string !== undefined) {
    out.query_string = typeof request.query_string === 'string'
      ? redactText(request.query_string)
      : redactDeep(request.query_string)
  }
  if (request.headers && typeof request.headers === 'object') {
    out.headers = Object.fromEntries(
      Object.entries(request.headers).filter(([name]) => REQUEST_HEADERS.has(name.toLowerCase())),
    )
  }
  return out as T
}

/** `{ id }` or nothing — no email, username, ip, segment, geo (D-8). */
export function rebuildUser(user: { id?: unknown } | null | undefined): { id: string } | null {
  if (!user || typeof user !== 'object') return null
  const id = user.id
  if (typeof id === 'string' && id !== '') return { id }
  if (typeof id === 'number') return { id: String(id) }
  return null
}

type DataRule = (data: Record<string, unknown>) => Record<string, unknown> | undefined

function pick(data: Record<string, unknown>, keys: string[], text: string[] = []): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {}
  for (const key of keys) {
    if (data[key] === undefined) continue
    out[key] = text.includes(key) && typeof data[key] === 'string' ? redactText(data[key] as string) : data[key]
  }
  return Object.keys(out).length ? out : undefined
}

const HTTP_DATA: DataRule = data => pick(data, ['url', 'method', 'status_code'], ['url'])

/** Kept categories and the `data` each may keep; `undefined` = `data` dropped. */
const BREADCRUMB_DATA: Record<string, DataRule | undefined> = {
  fetch: HTTP_DATA,
  xhr: HTTP_DATA,
  http: HTTP_DATA,
  navigation: data => pick(data, ['from', 'to'], ['from', 'to']),
  'ui.click': undefined,
  'app.lifecycle': data => pick(data, ['state']),
  'device.orientation': data => pick(data, ['orientation']),
  touch: undefined,
}

/** Allowlisted category, rebuilt fields; anything else, `console` included, is dropped (D-9). */
export function rebuildBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  const category = breadcrumb.category
  if (typeof category !== 'string' || !Object.prototype.hasOwnProperty.call(BREADCRUMB_DATA, category)) return null
  const out: Breadcrumb = {}
  if (breadcrumb.type !== undefined) out.type = breadcrumb.type
  out.category = category
  if (typeof breadcrumb.message === 'string') out.message = redactText(breadcrumb.message)
  if (breadcrumb.timestamp !== undefined) out.timestamp = breadcrumb.timestamp
  if (breadcrumb.level !== undefined) out.level = breadcrumb.level
  const rule = BREADCRUMB_DATA[category]
  if (rule && breadcrumb.data && typeof breadcrumb.data === 'object') {
    const data = rule(breadcrumb.data)
    if (data) out.data = data
  }
  return out
}

export function beforeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  return rebuildBreadcrumb(breadcrumb)
}

// --- filter ------------------------------------------------------------------

/**
 * By the `name` our constructors set (`errors.ts`), which minification does
 * not touch, and by class where importable. Never by message text.
 */
export function isIgnored(error: unknown): boolean {
  if (error instanceof ApiError || error instanceof NetworkError || error instanceof TimeoutError) return true
  if (!error || typeof error !== 'object') return false
  const name = (error as { name?: unknown }).name
  return typeof name === 'string' && IGNORED_ERROR_NAMES.has(name)
}

/** The thrown error, or — when the SDK gives no hint — the outermost exception's type. */
function isIgnoredEvent(event: ErrorEvent, hint?: EventHint): boolean {
  if (hint && hint.originalException !== undefined && hint.originalException !== null) {
    return isIgnored(hint.originalException)
  }
  const values = event.exception?.values
  const thrown = values?.[values.length - 1]
  return typeof thrown?.type === 'string' && IGNORED_ERROR_NAMES.has(thrown.type)
}

/**
 * The user the app itself declared through {@link setSentryUser} — never what
 * the event arrives with: the SDK merges the native scope's user (the native
 * SDK's installation id when nobody is signed in) into JS events.
 */
let appUserId: string | null = null

export function beforeSend(event: ErrorEvent, hint?: EventHint): ErrorEvent | null {
  if (isIgnoredEvent(event, hint)) return null
  const { user: _incoming, request, breadcrumbs, ...rest } = event
  const out = redactDeep(rest) as ErrorEvent
  if (appUserId) out.user = { id: appUserId }
  if (request) out.request = rebuildRequest(request)
  if (breadcrumbs) {
    out.breadcrumbs = breadcrumbs
      .map(rebuildBreadcrumb)
      .filter((crumb): crumb is Breadcrumb => crumb !== null)
  }
  return out
}

// --- native scope sync ---------------------------------------------------------

type SyncedScope = ReturnType<typeof Sentry.getIsolationScope>

/**
 * The SDK copies the global and isolation scopes into the native SDKs as they
 * are written (`setUser`, `setTag(s)`, `setExtra(s)`, `setContext`,
 * `setAttribute(s)`), and a native crash or watchdog report is built from
 * that copy — `beforeSend` never sees it. Breadcrumbs are copied only after
 * `beforeBreadcrumb`, so they are already rebuilt. Every other setter is
 * wrapped here so its value is rebuilt and redacted before the SDK forwards
 * it: the native copy then holds what an event would have held, whoever calls
 * the setter.
 */
function guardScope(scope: SyncedScope): void {
  const setUser = scope.setUser.bind(scope)
  scope.setUser = user => setUser(rebuildUser(user))
  const setTag = scope.setTag.bind(scope)
  scope.setTag = (key, value) => setTag(key, redactAt(key, value, `tags.${key}`) as typeof value)
  const setTags = scope.setTags.bind(scope)
  scope.setTags = tags =>
    setTags(Object.fromEntries(Object.entries(tags).map(([k, v]) => [k, redactAt(k, v, `tags.${k}`)])) as typeof tags)
  const setExtra = scope.setExtra.bind(scope)
  scope.setExtra = (key, value) => setExtra(key, redactAt(key, value, `extra.${key}`) as typeof value)
  const setExtras = scope.setExtras.bind(scope)
  scope.setExtras = extras =>
    setExtras(Object.fromEntries(Object.entries(extras).map(([k, v]) => [k, redactAt(k, v, `extra.${k}`)])) as typeof extras)
  const setContext = scope.setContext.bind(scope)
  scope.setContext = (key, context) =>
    setContext(key, redactAt(key, context, `contexts.${key}`) as typeof context)
  const setAttribute = scope.setAttribute.bind(scope)
  scope.setAttribute = ((key: string, value: unknown) =>
    setAttribute(key, redactAt(key, value, `attributes.${key}`) as never)) as typeof scope.setAttribute
  const setAttributes = scope.setAttributes.bind(scope)
  scope.setAttributes = ((attributes: Record<string, unknown>) =>
    setAttributes(Object.fromEntries(
      Object.entries(attributes).map(([k, v]) => [k, redactAt(k, v, `attributes.${k}`)]),
    ) as never)) as typeof scope.setAttributes
}

// --- init and helpers ------------------------------------------------------------

export type SentryEnvironment = 'dev' | 'staging' | 'prod'

/** Build flavour → BE's environment vocabulary (D-3); never `__DEV__`. */
export function sentryEnvironment(flavor: 'dev' | 'stag' | 'prod'): SentryEnvironment {
  return flavor === 'stag' ? 'staging' : flavor
}

/**
 * `https://<key>@<host>[:port]/<project>`; `http` is accepted for the local
 * envelope relay of the acceptance run. Checked by hand rather than with
 * `URL`: React Native's `URL` does not implement the getters this would need.
 */
const DSN = /^https?:\/\/[A-Za-z0-9]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*(?::(\d{1,5}))?\/\d+$/

export function isDsn(value: string): boolean {
  const match = DSN.exec(value)
  if (!match) return false
  const port = match[1]
  return port === undefined || (Number(port) >= 1 && Number(port) <= 65535)
}

let enabled = false

/** `''` and the literal `off` disable; any other value must be a DSN — `OFF` is a typo, not a decision (C-15). */
export function initSentry(options: { dsn: string; environment: SentryEnvironment }): void {
  const dsn = options.dsn.trim()
  if (dsn === '' || dsn === 'off') {
    enabled = false
    return
  }
  if (!isDsn(dsn)) throw new Error('Invalid SENTRY DSN: expected https://<key>@<host>/<project> or "off"')
  Sentry.init({
    dsn,
    environment: options.environment,
    sendDefaultPii: false,
    enableAutoSessionTracking: false,
    enableAutoPerformanceTracing: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    enableNativeCrashHandling: true,
    // Errors only (D-1): client reports are a separate envelope of SDK
    // statistics, sent even when every event is dropped.
    sendClientReports: false,
    beforeSend,
    beforeBreadcrumb,
    // Read by the native iOS SDK from the options dictionary (not in the RN
    // types): its URLSession breadcrumbs carry full URLs into native crash
    // reports, which `beforeSend` never sees.
    //
    // Native automatic breadcrumbs never pass `beforeBreadcrumb` and land in
    // native crash reports as recorded (iOS `ui.lifecycle` carries screen
    // titles). Off on both platforms; the JS breadcrumbs the SDK copies to
    // native have already been rebuilt.
    ...({
      enableNetworkBreadcrumbs: false,
      enableAutoBreadcrumbTracking: false,
      enableNetworkEventBreadcrumbs: false,
      enableActivityLifecycleBreadcrumbs: false,
      enableAppLifecycleBreadcrumbs: false,
      enableSystemEventBreadcrumbs: false,
      enableAppComponentBreadcrumbs: false,
    } as object),
  })
  guardScope(Sentry.getGlobalScope())
  guardScope(Sentry.getIsolationScope())
  enabled = true
}

export type ErrorKind = 'boundary'

export function captureError(error: unknown, context: { kind: ErrorKind }): void {
  if (!enabled) return
  Sentry.captureException(error, { tags: { kind: context.kind } })
}

/** A pseudonymous user id, or `null` for guests and signed-out (D-8). */
export function setSentryUser(id: string | null): void {
  appUserId = id || null
  if (!enabled) return
  Sentry.setUser(appUserId ? { id: appUserId } : null)
}

/** `Sentry.wrap` when enabled — its touch boundary records breadcrumbs — else the component itself. */
export function wrapRoot(component: ComponentType): ComponentType {
  return enabled ? (Sentry.wrap(component as ComponentType<Record<string, unknown>>) as ComponentType) : component
}

/** Test seam: forget whether `initSentry` ran. */
export function resetSentryForTests(): void {
  enabled = false
  appUserId = null
}
