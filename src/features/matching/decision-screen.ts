import type { RoomSummary, SuggestionsCurrent } from '@/shared/api'

export type DecisionScreen = 'swipe' | 'match-result'

/**
 * Where a room's current run is decided, by decision mode (spec §7.2,
 * FR-ROOM-002). The rule the matching screen always used, lifted out so the
 * lobby sends a member to the same place the host's own flow does (#198):
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
