/**
 * GoGo-MobileApp#199: an empty deck means different things, and each needs its
 * own words. Only a room with no run yet is still waiting for people to pick;
 * a stale run needs a refresh; a finished run with no candidates found nothing
 * that fits the room.
 */
export type SuggestionRunState = 'none' | 'stale' | 'empty' | 'ready'

export function suggestionRunState(
  data: { run?: { stale?: boolean } | null; candidates?: readonly unknown[] } | undefined,
): SuggestionRunState {
  if (!data?.run) return 'none'
  if (data.run.stale) return 'stale'
  return (data.candidates ?? []).length === 0 ? 'empty' : 'ready'
}
