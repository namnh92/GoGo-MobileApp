import { formatRange, perPerson } from '@/shared/pricing/money'

import type {
  PlaceDetail,
  PlaceSearchResult,
  Plan,
  PlanStop,
  RoomSummary,
  SuggestionCandidate,
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

export interface PlaceCard {
  id: string
  name: string
  areaKey?: string
  addressText?: string
  lat?: number
  lng?: number
  rating?: number
  ratingCount?: number
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
  isLodging: boolean
  reasonCodes: string[]
  /** Stale place data must be flagged rather than shown as certain. */
  freshnessCheckedAt?: string
  /**
   * Real place imagery. Always null until the contract carries it
   * (GoGo-BE#151) — `PlacePhoto` renders a neutral placeholder meanwhile,
   * because a stock photo would read as a picture of the venue.
   */
  photoUrl: string | null
  /** Required beside provider imagery; null while there is none to attribute. */
  photoAttribution: string | null
}

const PRICE_CONFIDENCE_FLOOR = 0.6

export function toPlaceCard(result: PlaceSearchResult): PlaceCard {
  const price = result.pricePerPerson
  return {
    id: result.id,
    name: result.name,
    areaKey: result.areaKey,
    addressText: result.addressText,
    lat: result.lat,
    lng: result.lng,
    rating: result.rating,
    ratingCount: result.ratingCount,
    distanceM: result.distanceM,
    priceMin: price?.min ?? null,
    priceMax: price?.max ?? null,
    currency: price?.currency ?? 'VND',
    priceUncertain: price == null || (price.confidence ?? 0) < PRICE_CONFIDENCE_FLOOR,
    openNow: result.open?.openNow,
    closesAtMinute: result.open?.closesAtMinute,
    opensAtMinute: result.open?.opensAtMinute,
    isLodging: result.isLodging,
    reasonCodes: result.reasonCodes ?? [],
    freshnessCheckedAt: result.freshnessCheckedAt,
    // Becomes `result.primaryPhoto` once GoGo-BE#151 ships.
    photoUrl: null,
    photoAttribution: null,
  }
}

/**
 * `PlaceDetail` is snake_case and declares no required fields, unlike every
 * other DTO — this adapter is the only place that has to know that.
 */
export function detailToPlaceCard(detail: PlaceDetail): PlaceCard {
  const price = detail.prices?.[0]
  return {
    id: detail.id ?? '',
    name: detail.name ?? '',
    areaKey: detail.area_key,
    addressText: detail.address_text,
    lat: detail.lat,
    lng: detail.lng,
    rating: detail.rating,
    ratingCount: detail.rating_count,
    priceMin: price?.priceMin ?? null,
    priceMax: price?.priceMax ?? null,
    currency: price?.currency ?? 'VND',
    priceUncertain: price == null || (price.confidence ?? 0) < PRICE_CONFIDENCE_FLOOR,
    isLodging: detail.is_lodging ?? false,
    reasonCodes: [],
    freshnessCheckedAt: detail.freshness_checked_at,
    // Becomes `detail.photos[0]` once GoGo-BE#151 ships.
    photoUrl: null,
    photoAttribution: null,
  }
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

/** Per-person price line for a card. Returns null when the price is unknown. */
export function placePriceLabel(card: PlaceCard): string | null {
  return formatRange(card.priceMin, card.priceMax, card.currency)
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
  /** Explainable score parts, highest first — drives "Vì sao phù hợp". */
  topComponents: { key: string; value: number }[]
  myVote?: SuggestionCandidate['myVote']
  points: number
  stale: boolean
}

export function toCandidateCard(candidate: SuggestionCandidate): CandidateCard {
  const components = Object.entries(candidate.components ?? {})
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)

  return {
    placeId: candidate.placeId ?? '',
    name: candidate.name ?? '',
    rank: candidate.rank ?? 0,
    score: candidate.score ?? 0,
    reasonCodes: candidate.reasonCodes ?? [],
    topComponents: components,
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
  isLocked: boolean
  status: NonNullable<PlanStop['status']>
  completedAt?: string
}

function timeLabel(iso: string | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
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
    isLocked: stop.isLocked ?? false,
    status: stop.status ?? 'planned',
    completedAt: stop.completedAt,
  }
}

export interface PlanSummary {
  id: string
  roomId: string
  version: number
  isStale: boolean
  stops: PlanStopRow[]
  costMin: number
  costMax: number
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
  return {
    id: plan.id ?? '',
    roomId: plan.roomId ?? '',
    version: plan.version ?? 1,
    isStale: plan.isStale ?? false,
    stops: (plan.stops ?? []).map(toPlanStopRow).sort((a, b) => a.position - b.position),
    costMin: totals?.costMin ?? 0,
    costMax: totals?.costMax ?? 0,
    currency: totals?.currency ?? 'VND',
    durationMinutes: totals?.durationMinutes ?? 0,
    travelDistanceM: totals?.travelDistanceM ?? 0,
    overBudget: totals?.overBudget ?? false,
    uncertain: totals?.uncertain ?? false,
  }
}

/** Per-person share of a plan total, for group rooms. */
export function planPerPerson(plan: PlanSummary, participantCount: number): number {
  return perPerson(plan.costMax, participantCount, plan.currency)
}
