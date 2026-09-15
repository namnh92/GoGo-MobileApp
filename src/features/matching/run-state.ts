import { isApiError } from '@/shared/api/errors'

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

/**
 * Why the host's refresh was refused, so the screen can say so instead of a
 * blind retry. Callers map it to a key with an inline literal lookup, which
 * the i18n key scan can read. `errors` is imported directly: the API barrel
 * pulls React Native, which vitest cannot load.
 */
export type RegenerateFailure = 'race' | 'quorum' | 'failed'

export function regenerateFailure(error: unknown): RegenerateFailure {
  if (isApiError(error) && error.code === 'STALE_SUGGESTIONS') return 'race'
  if (isApiError(error) && error.code === 'MATCHING_QUORUM_REQUIRED') return 'quorum'
  return 'failed'
}
