import { formatRange } from '@/shared/pricing/money'
import { isStandalonePrice, toPriceUnit } from '@/shared/pricing/price-unit'

import type { PriceUnit } from '@/shared/pricing/price-unit'

import type {
  PlaceDetail,
  PlacePhoto,
  PlaceSearchResult,
  Plan,
  PlanStop,
  RoomSummary,
  SuggestionCandidate,
  BudgetScope,
} from './types'

/**
 * DTOs carry facts; screens render rows. These adapters are the single place
 * that turns one into the other, so a contract change lands here instead of in
 * twenty components — and so composed copy is never built on the server
 * (RULE-API-DTO).
 */

// ---------------------------------------------------------------------------
// Places
// ---------------------------------------------------------------------------

/** Normalized, optional #774 facts. Populate only from explicit contract facts.
 * Search reason codes and confidence cannot populate any of these fields.
 */
export interface DiscoveryCardFacts {
  categoryLabel?: string
  verified?: boolean
  tagLabels?: readonly string[]
  areaLabel?: string
}
export interface PlaceCard {
  hours?: PlaceDetail['hours']
  taxonomies?: PlaceDetail['taxonomies']
  providerStatus?: PlaceDetail['providerStatus']
  moderationStatus?: PlaceDetail['status']
  discovery?: DiscoveryCardFacts
  id: string
  name: string
  areaKey?: string
  addressText?: string
  areaSummary?: PlaceSearchResult['areaSummary']
  lat?: number
  lng?: number
  rating?: number
  ratingCount?: number
  gogoRating?: number
  gogoRatingCount?: number
  distanceM?: number
  /** Per-person estimate in minor units; null when the price is unknown. */
  priceMin: number | null
  priceMax: number | null
  currency: string
  /** Low provider confidence must surface as an estimate, never a fact. */
  priceUncertain: boolean
  openNow?: boolean
  closesAtMinute?: number
  opensAtMinute?: number
  opensDayOffset?: number
  isLodging: boolean
  reasonCodes: string[]
  /** Stale place data must be flagged rather than shown as certain. */
  freshnessCheckedAt?: string
  /**
   * Real place imagery from the contract (`primaryPhoto` / `photos[0]`). Null
   * when the place has no approved photo — the contract omits a photo rather
   * than sending a URL that will not load, and `PlacePhoto` then renders a
   * neutral placeholder. A stock photo would read as a picture of the venue.
   */
  photoUrl: string | null
  /** Required beside provider imagery; null while there is none to attribute. */
  photoAttribution: string | null
  /** Lets the UI tell imported from community imagery apart. */
  photoSource: PlacePhoto['source'] | null
  photoAuthors?: PlacePhoto['authorAttributions']
  /**
   * The rating is provider data, never a GoGo community score — the contract
   * is kept separate from the optional GoGo community aggregate (spec §6).
   */
  ratingSource: 'google'
  /** What the price is per. `unknown` when the contract carries no price. */
  priceUnit: PriceUnit
}

const PRICE_CONFIDENCE_FLOOR = 0.6

export type TaxonomyLabels = Record<string, Record<string, string>>

export function toPlaceCard(result: PlaceSearchResult, labels?: TaxonomyLabels): PlaceCard {
  const price = result.pricePerPerson
  const photo = result.primaryPhoto
  return {
    ...(result.verification || result.taxonomies || result.areaSummary ? { discovery: {
      ...(result.verification ? { verified: result.verification.status === 'verified' } : {}),
      ...(result.areaSummary?.label ? { areaLabel: result.areaSummary.label } : {}),
      ...(result.taxonomies ? { tagLabels: [...new Set(result.taxonomies.flatMap(tag => tag.kind && tag.key && labels?.[tag.kind]?.[tag.key] ? [labels[tag.kind]![tag.key]!] : []))] } : {}),
    } } : {}),
    id: result.id,
    name: result.name,
    areaKey: result.areaKey,
    addressText: result.addressText,
    areaSummary: result.areaSummary,
    lat: result.lat,
    lng: result.lng,
    rating: result.rating,
    ratingCount: result.ratingCount,
    gogoRating: result.gogoRating,
    gogoRatingCount: result.gogoRatingCount,
    distanceM: result.distanceM,
    priceMin: price?.min ?? null,
    priceMax: price?.max ?? null,
    currency: price?.currency ?? 'VND',
    priceUncertain: price == null || (price.confidence ?? 0) < PRICE_CONFIDENCE_FLOOR,
    openNow: result.open?.openNow,
    closesAtMinute: result.open?.closesAtMinute,
    opensAtMinute: result.open?.opensAtMinute,
    opensDayOffset: result.open?.opensDayOffset,
    isLodging: result.isLodging,
    reasonCodes: result.reasonCodes ?? [],
    freshnessCheckedAt: result.freshnessCheckedAt,
    photoUrl: photo?.url ?? null,
    photoAttribution: photo?.attribution ?? null,
    photoSource: photo?.source ?? null,
    photoAuthors: photo?.authorAttributions,
    ratingSource: 'google',
    // Search only ever quotes a per-person estimate; `pricePerPerson` is the
    // field's own name, so the unit is not a guess.
    priceUnit: price == null ? 'unknown' : 'per_person',
  }
}

/**
 * `PlaceDetail` declares no required fields, and historically served Postgres
 * `numeric` columns as **strings** (`rating: "4.60"`) despite the contract
 * declaring them as numbers. Dev now returns numbers, but the DTO still
 * promises nothing, so everything numeric out of it goes through `toNumber`
 * rather than trusting the current serialiser.
 */
export function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

/**
 * Timestamps are declared ISO-8601, but the raw-SQL-row DTOs hand back the
 * Postgres rendering — `2026-08-26 23:40:14.332+00`, with a space instead of
 * `T` and a two-digit offset. Hermes rejects that as an Invalid Date, which
 * then renders as the literal text "Invalid Date" on screen.
 */
export function parseApiDate(value: string | undefined | null): Date | undefined {
  if (!value) return undefined

  const direct = new Date(value)
  if (!Number.isNaN(direct.getTime())) return direct

  const normalised = value.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')
  const repaired = new Date(normalised)
  return Number.isNaN(repaired.getTime()) ? undefined : repaired
}

/**
 * Offline plan summaries and pending contribution cards carry partial facts.
 * Missing prices, ratings and provider facts stay unknown/empty; taxonomy
 * labels are resolved only when supplied by the caller.
 */
export function detailToPlaceCard(detail: Partial<PlaceDetail>, labels?: TaxonomyLabels): PlaceCard {
  const price = detail.prices?.[0]
  const priceConfidence = toNumber(price?.confidence) ?? 0
  const photo = detail.photos?.[0]
  return {
    hours: detail.hours,
    taxonomies: detail.taxonomies,
    providerStatus: detail.providerStatus,
    moderationStatus: detail.status,
    areaSummary: detail.areaSummary,
    discovery: {
      ...(detail.verification ? { verified: detail.verification.status === 'verified' } : {}),
      categoryLabel: detail.taxonomies?.filter(tag => tag.kind === 'category').flatMap(tag => tag.key && labels?.category?.[tag.key] ? [labels.category[tag.key]!] : []).join(' · ') || undefined,
      tagLabels: [...new Set(detail.taxonomies?.flatMap(tag => tag.kind && tag.key && labels?.[tag.kind]?.[tag.key] ? [labels[tag.kind]![tag.key]!] : []) ?? [])],
    },
    id: detail.id ?? '',
    name: detail.name ?? '',
    areaKey: detail.areaKey,
    addressText: detail.addressText,
    lat: toNumber(detail.lat),
    lng: toNumber(detail.lng),
    rating: toNumber(detail.rating),
    ratingCount: toNumber(detail.ratingCount),
    gogoRating: toNumber(detail.gogoRating),
    gogoRatingCount: toNumber(detail.gogoRatingCount),
    priceMin: toNumber(price?.priceMin) ?? null,
    priceMax: toNumber(price?.priceMax) ?? null,
    currency: price?.currency ?? 'VND',
    priceUncertain: price == null || priceConfidence < PRICE_CONFIDENCE_FLOOR,
    isLodging: detail.isLodging ?? false,
    reasonCodes: [],
    freshnessCheckedAt: detail.freshnessCheckedAt,
    photoUrl: photo?.url ?? null,
    photoAttribution: photo?.attribution ?? null,
    photoSource: photo?.source ?? null,
    photoAuthors: photo?.authorAttributions,
    ratingSource: 'google',
    priceUnit: toPriceUnit(price?.unit, price != null),
  }
}

type OpeningHour = NonNullable<PlaceDetail['hours']>[number]

export interface DerivedOpenState {
  openNow?: boolean
  closesAtMinute?: number
  opensAtMinute?: number
  /** 0 = today, 1 = tomorrow — lets copy say "mở lại 09:00 mai". */
  opensDayOffset?: number
}

const MINUTES_PER_DAY = 24 * 60
const DAYS_PER_WEEK = 7

/**
 * `PlaceSearchResult` ships an `open` block, but `PlaceDetail` only ships raw
 * `hours`, so the detail screen has to derive the same facts rather than claim
 * "open now" from nothing (RULE-CORE-008).
 *
 * `isOvernight` means the entry closes after midnight, so a place open
 * 18:00–02:00 is still open at 01:00 — under *yesterday's* entry.
 */
export function vietnamClock(now: Date) {
  // Vietnam has one time zone and no daylight saving. Never use the device zone.
  const local = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  return { day: local.getUTCDay(), minute: local.getUTCHours() * 60 + local.getUTCMinutes() }
}

export function openStateFromHours(hours: OpeningHour[] | undefined, now = new Date()): DerivedOpenState {
  if (!hours || hours.length === 0) return {}

  const { day, minute } = vietnamClock(now)

  for (const entry of hours) {
    if (entry.dayOfWeek !== day || entry.openMinute == null || entry.closeMinute == null) continue
    const openNow = entry.isOvernight
      ? minute >= entry.openMinute
      : minute >= entry.openMinute && minute < entry.closeMinute
    if (openNow) return { openNow: true, closesAtMinute: entry.closeMinute }
  }

  // Yesterday's overnight session may still be running.
  const yesterday = (day + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK
  for (const entry of hours) {
    if (entry.dayOfWeek !== yesterday || !entry.isOvernight || entry.closeMinute == null) continue
    if (minute < entry.closeMinute) return { openNow: true, closesAtMinute: entry.closeMinute }
  }

  // Closed: find the next opening within a week.
  for (let offset = 0; offset < DAYS_PER_WEEK; offset += 1) {
    const target = (day + offset) % DAYS_PER_WEEK
    const candidates = hours
      .filter(entry => entry.dayOfWeek === target && entry.openMinute != null)
      .map(entry => entry.openMinute as number)
      .filter(openMinute => offset > 0 || openMinute > minute)
      .sort((a, b) => a - b)

    if (candidates.length > 0) return { openNow: false, opensAtMinute: candidates[0], opensDayOffset: offset }
  }

  return { openNow: false }
}

/** Total minutes a place is open on a given weekday — used for "closed today". */
export function minutesOpenOnDay(hours: OpeningHour[] | undefined, day: number): number {
  if (!hours) return 0
  return hours
    .filter(entry => entry.dayOfWeek === day && entry.openMinute != null && entry.closeMinute != null)
    .reduce((total, entry) => {
      const open = entry.openMinute as number
      const close = entry.closeMinute as number
      return total + (entry.isOvernight ? MINUTES_PER_DAY - open + close : close - open)
    }, 0)
}

/** "18:30" from the minute-of-day the contract uses for opening hours. */
export function formatMinuteOfDay(minute: number | undefined): string | null {
  if (minute == null) return null
  const clamped = Math.max(0, Math.min(minute, 24 * 60 - 1))
  const hours = String(Math.floor(clamped / 60)).padStart(2, '0')
  const minutes = String(clamped % 60).padStart(2, '0')
  return `${hours}:${minutes}`
}

export function formatDistance(distanceM: number | undefined): string | null {
  if (distanceM == null) return null
  if (distanceM < 1000) return `${Math.round(distanceM / 100) * 100} m`
  return `${(distanceM / 1000).toFixed(1).replace('.', ',')} km`
}

/**
 * Human-readable location for a card.
 *
 * Prefer the address, then the verified administrative label. Labels are
 * proper names and remain usable regardless of their reported locale.
 * Neither the discovery chip nor the internal `areaKey` is an address source.
 */
export function areaLabel(card: Pick<PlaceCard, 'addressText' | 'areaSummary'>): string | null {
  return card.addressText || card.areaSummary?.label || null
}

/** Per-person price line for a card. Returns null when the price is unknown. */
export function placePriceLabel(card: PlaceCard): string | null {
  return formatRange(card.priceMin, card.priceMax, card.currency)
}

/**
 * Amount plus the unit it is measured in, kept apart so the caller can put the
 * unit through i18n. A price whose scope is unknown returns no amount at all —
 * "150k–250k" with no unit is exactly the ambiguity spec §5 forbids.
 */
export function placePriceParts(card: PlaceCard): { amount: string | null; unit: PriceUnit } {
  if (card.priceUnit === 'unknown') return { amount: null, unit: 'unknown' }
  if (card.priceUnit === 'free') return { amount: null, unit: 'free' }
  const amount = formatRange(card.priceMin, card.priceMax, card.currency)
  if (amount == null) return { amount: null, unit: 'unknown' }
  return { amount: card.priceUncertain ? `~${amount}` : amount, unit: card.priceUnit }
}

/**
 * Rating with its provenance. Provider ratings and GoGo community ratings are
 * different measurements of different things and must never merge into one
 * star (spec §6). #754 exposes an optional community aggregate, suppressed
 * below five published reviews even if an inconsistent server sends a score.
 */
export function ratingParts(card: Pick<PlaceCard, 'rating' | 'ratingCount' | 'ratingSource' | 'gogoRating' | 'gogoRatingCount'>): {
  google: { value: number; count?: number } | null
  gogo: { value: number; count?: number } | null
} {
  return {
    google: card.rating == null ? null : { value: card.rating, count: card.ratingCount },
    gogo: card.gogoRating != null && (card.gogoRatingCount ?? 0) >= 5 ? { value: card.gogoRating, count: card.gogoRatingCount } : null,
  }
}

/**
 * Number separators for the two supported locales. Written out rather than
 * `toLocaleString`: Hermes ships without full ICU on Android, and a count that
 * renders "1,234" in Vietnamese reads as one-point-two.
 */
function separators(locale: string): { decimal: string; thousands: string } {
  return locale.startsWith('vi') ? { decimal: ',', thousands: '.' } : { decimal: '.', thousands: ',' }
}

/** "4,6" (vi) / "4.6" (en) — one decimal. */
export function formatRating(rating: number, locale = 'vi'): string {
  return rating.toFixed(1).replace('.', separators(locale).decimal)
}

/** "1.234" (vi) / "1,234" (en). */
export function formatCount(count: number, locale = 'vi'): string {
  return String(Math.round(count)).replace(/\B(?=(\d{3})+(?!\d))/g, separators(locale).thousands)
}

/**
 * PlaceCard line 2 (#293 §3): category · area · distance, in that order, each
 * part omitted when there is no fact for it. Null when all three are missing,
 * so the card drops the row instead of rendering an empty one.
 */
export function placeCardMetaLine(card: PlaceCard, categoryLabel?: string | null): string | null {
  const line = [categoryLabel, areaLabel(card), formatDistance(card.distanceM)].filter(Boolean).join(' · ')
  return line || null
}

/**
 * PlaceCard line 3: `★ 4,6 (980) Google · 45k–90k/người`. The rating comes back as
 * parts so the card can set the score heavier inside the same line; the price
 * always carries its unit (RULE-CORE-013), and "Miễn phí" stands in for a free price; unknown prices are omitted.
 *
 * Owner decision 2026-11-07 supersedes the 2026-09-24 list-card exception:
 * renderers must show the Google mark beside this score and count. GoGo stays
 * separate with its own mark and sample size.
 */
export function placeCardRatingPriceLine(
  card: PlaceCard,
  unitLabel: (unit: Exclude<PriceUnit, 'unknown'>) => string,
  locale = 'vi',
): { rating: { score: string; count: string | null } | null; price: string } {
  const { google } = ratingParts(card)
  const { amount, unit } = placePriceParts(card)
  return {
    rating: google
      ? { score: formatRating(google.value, locale), count: google.count != null ? formatCount(google.count, locale) : null }
      : null,
    price: unit === 'unknown' ? '' : amount && !isStandalonePrice(unit) ? `${amount}${unitLabel(unit)}` : unitLabel(unit),
  }
}

/** Same, straight from a `PlaceDetail` — null when it carries no price. */
export function formatRangeForPlace(detail: PlaceDetail | undefined): string | null {
  const price = detail?.prices?.[0]
  if (!price) return null
  return formatRange(toNumber(price.priceMin), toNumber(price.priceMax), price.currency ?? 'VND')
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

/**
 * Audience facts for copy. Never derive tone from a route name — a group room
 * reached through the couple flow is still a group room (RULE-CORE-003).
 */
export interface RoomAudience {
  roomType: RoomSummary['type']
  participantCount: number
  budgetMode: NonNullable<RoomSummary['constraints']>['budgetMode']
  budgetAmount: number
  currency: string
  isHost: boolean
  isGuest: boolean
  /** i18n `context` value: 'couple' | 'group'. */
  copyContext: 'couple' | 'group'
}

export function toRoomAudience(room: RoomSummary, isGuestSession = false): RoomAudience {
  const constraints = room.constraints
  return {
    roomType: room.type,
    participantCount: room.participantCount,
    budgetMode: constraints?.budgetMode ?? 'total',
    budgetAmount: constraints?.budgetAmount ?? 0,
    currency: constraints?.currency ?? 'VND',
    isHost: room.myRole === 'host',
    isGuest: isGuestSession,
    copyContext: room.type,
  }
}

/** Lobby progress: how many members have finished picking. */
export function memberProgress(room: RoomSummary): { completed: number; total: number } {
  const members = room.members ?? []
  return {
    completed: members.filter(member => member.selectionStatus === 'completed').length,
    total: members.length || room.participantCount,
  }
}

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

export interface CandidateCard {
  placeId: string
  name: string
  rank: number
  score: number
  reasonCodes: string[]
  /** Every explainable score part the engine reported, unfiltered. */
  components: Record<string, number>
  /** The three strongest parts, highest first — drives "Vì sao phù hợp". */
  topComponents: { key: string; value: number }[]
  myVote?: SuggestionCandidate['myVote']
  points: number
  stale: boolean
}

export function toCandidateCard(candidate: SuggestionCandidate): CandidateCard {
  const components = candidate.components ?? {}
  const ranked = Object.entries(components)
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value)

  return {
    placeId: candidate.placeId ?? '',
    name: candidate.name ?? '',
    rank: candidate.rank ?? 0,
    score: candidate.score ?? 0,
    reasonCodes: candidate.reasonCodes ?? [],
    components,
    topComponents: ranked.slice(0, 3),
    myVote: candidate.myVote,
    points: candidate.points ?? 0,
    stale: candidate.stale ?? false,
  }
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export interface PlanStopRow {
  id: string
  placeId: string
  position: number
  /** "18:30" — display only. The id, not the time, identifies the stop. */
  arriveLabel: string | null
  departLabel: string | null
  durationMinutes: number
  travelMinutesFromPrev: number | null
  travelDistanceMFromPrev: number | null
  costMin: number | null
  costMax: number | null
  /** What `costMin`/`costMax` are per; `null` for a plan cached before the contract said. */
  costScope: BudgetScope | null
  isLocked: boolean
  status: NonNullable<PlanStop['status']>
  completedAt?: string
}

function timeLabel(iso: string | undefined): string | null {
  const date = parseApiDate(iso)
  if (!date) return null
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function toPlanStopRow(stop: PlanStop): PlanStopRow {
  return {
    id: stop.id ?? '',
    placeId: stop.placeId ?? '',
    position: stop.position ?? 0,
    arriveLabel: timeLabel(stop.arriveAt),
    departLabel: timeLabel(stop.departAt),
    durationMinutes: stop.durationMinutes ?? 0,
    travelMinutesFromPrev: stop.travelMinutesFromPrev ?? null,
    travelDistanceMFromPrev: stop.travelDistanceMFromPrev ?? null,
    costMin: stop.costMin ?? null,
    costMax: stop.costMax ?? null,
    costScope: stop.costScope ?? null,
    isLocked: stop.isLocked ?? false,
    status: stop.status ?? 'planned',
    completedAt: stop.completedAt,
  }
}

export interface PlanSummary {
  id: string
  roomId: string
  version: number
  /** `superseded` means an edit or regenerate replaced this plan. */
  status: NonNullable<Plan['status']>
  isStale: boolean
  stops: PlanStopRow[]
  costMin: number
  costMax: number
  /**
   * What `costMin`/`costMax` are per (GoGo-BE#593) — `per_person` today.
   * `null` when the plan was cached before the contract stated it: an amount
   * of unknown scope is never assumed to be per person (RULE-CORE-013).
   */
  costScope: BudgetScope | null
  /** Some stop has a price in `costScope`; otherwise there is no amount to show. */
  priced: boolean
  /**
   * Some stop has no price in `costScope`, so `costMax` is a floor. Read from
   * the stops rather than `uncertain`, which also covers low confidence and was
   * `false` on plans stored before GoGo-BE#593 even with an unpriced stop.
   */
  hasUnpricedStop: boolean
  currency: string
  durationMinutes: number
  travelDistanceM: number
  /** Computed from the UPPER bound — never show "within budget" when true. */
  overBudget: boolean
  /** Some stop has an unknown price; the total is an estimate. */
  uncertain: boolean
}

export function toPlanSummary(plan: Plan): PlanSummary {
  const totals = plan.totals
  const stops = (plan.stops ?? []).map(toPlanStopRow).sort((a, b) => a.position - b.position)
  return {
    id: plan.id ?? '',
    roomId: plan.roomId ?? '',
    version: plan.version ?? 1,
    status: plan.status ?? 'current',
    isStale: plan.isStale ?? false,
    stops,
    costMin: totals?.costMin ?? 0,
    costMax: totals?.costMax ?? 0,
    costScope: totals?.costScope ?? null,
    priced: stops.some(stop => stop.costMin !== null || stop.costMax !== null),
    hasUnpricedStop: stops.some(stop => stop.costMin === null || stop.costMax === null),
    currency: totals?.currency ?? 'VND',
    durationMinutes: totals?.durationMinutes ?? 0,
    travelDistanceM: totals?.travelDistanceM ?? 0,
    overBudget: totals?.overBudget ?? false,
    uncertain: totals?.uncertain ?? false,
  }
}
