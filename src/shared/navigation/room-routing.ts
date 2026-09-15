import type { RoomSummary, SuggestionsCurrent } from '@/shared/api'

/**
 * GoGo-MobileApp#198 — where a room sends people, shared by the lobby, the
 * matching screen and the inbox so they cannot drift apart.
 */

export type DecisionScreen = 'swipe' | 'match-result'

/**
 * Where a room's current run is decided, by decision mode (spec §7.2,
 * FR-ROOM-002). The rule the matching screen always used:
 *
 *   - `host` mode, a ballot I have already filled, or a room already `ready`
 *     → the result;
 *   - otherwise (`match`, `vote`) → the deck, to vote.
 *
 * No run, a stale run, or no decision mode yet → nowhere: nothing is ready to
 * decide.
 */
export function decisionScreen(
  decisionMode: RoomSummary['decisionMode'] | undefined,
  status: RoomSummary['status'] | undefined,
  suggestions: SuggestionsCurrent | undefined,
): DecisionScreen | null {
  if (!suggestions?.run || suggestions.run.stale || !decisionMode) return null
  const candidates = suggestions.candidates ?? []
  const ballotComplete =
    candidates.length > 0 &&
    candidates.every(candidate => candidate.placeId && suggestions.votes?.mine?.[candidate.placeId])
  return decisionMode === 'host' || ballotComplete || status === 'ready' ? 'match-result' : 'swipe'
}

/** Notification kinds about a plan: they open the room's plan, not its lobby. */
export const PLAN_KINDS: ReadonlySet<string> = new Set(['plan_ready', 'plan_changed', 'date_reminder'])

/**
 * Why a room opened instead of the plan a notification was about; the lobby
 * says which. The two are different sentences on purpose: one will not change
 * by trying again, the other will.
 */
/** The room has no plan that can be opened. */
export const PLAN_UNAVAILABLE_NOTICE = 'plan_unavailable'
/** The plan could not be read just now; the lobby moves on once it can. */
export const PLAN_RETRY_NOTICE = 'plan_retry'
