import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as suggestionsApi from '../endpoints/suggestions'
import { newIdempotencyKey } from '../idempotency'
import { queryKeys } from '../query-keys'
import type { OpBody, SuggestionsCurrent, VoteValue } from '../types'

/**
 * Current ranking plus my votes and the tally. When no run exists the server
 * answers `{ run: null, candidates: [], votes: … }` with `decisionMode` absent,
 * so screens must treat "no run yet" as an empty state, not an error.
 */
export function useCurrentSuggestions(roomId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.roomSuggestions(roomId ?? ''),
    queryFn: () => suggestionsApi.getCurrentSuggestions(roomId as string),
    enabled: Boolean(roomId),
  })
}

export function useGenerateSuggestions(roomId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => suggestionsApi.generateSuggestions(roomId),
    onSuccess: run => {
      queryClient.setQueryData(queryKeys.roomSuggestions(roomId), run)
      void queryClient.invalidateQueries({ queryKey: queryKeys.room(roomId) })
    },
  })
}

/**
 * Optimistic vote. Votes are idempotent server-side, so a retry after a
 * transport failure is safe; the key is generated once per intent so a retry
 * carries the same one.
 */
export function useCastVote(roomId: string) {
  const queryClient = useQueryClient()
  const key = queryKeys.roomSuggestions(roomId)

  return useMutation({
    mutationFn: ({ placeId, value }: { placeId: string; value: VoteValue }) =>
      suggestionsApi.castVote(roomId, placeId, value, newIdempotencyKey()),

    onMutate: async ({ placeId, value }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<SuggestionsCurrent>(key)
      if (previous) {
        queryClient.setQueryData<SuggestionsCurrent>(key, {
          ...previous,
          candidates: previous.candidates?.map(candidate =>
            candidate.placeId === placeId ? { ...candidate, myVote: value } : candidate,
          ),
          votes: { ...previous.votes, mine: { ...previous.votes?.mine, [placeId]: value } },
        })
      }
      return { previous }
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },

    onSuccess: result => {
      // A couple match creates the plan immediately — pull it in.
      if (result?.matched && result.planId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.roomCurrentPlan(roomId) })
        void queryClient.invalidateQueries({ queryKey: queryKeys.room(roomId) })
      }
    },

    onSettled: () => {
      // The tally is server-computed; never trust the optimistic copy for long.
      void queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

/** Host-only. Produces plan v1 and moves the room forward. */
export function useFinalizeVotes(roomId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: OpBody<'finalizeVotes'> = {}) => suggestionsApi.finalizeVotes(roomId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.room(roomId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.roomSuggestions(roomId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.roomCurrentPlan(roomId) })
    },
  })
}
