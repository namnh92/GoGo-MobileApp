import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import * as preferencesApi from '../endpoints/preferences'
import { queryKeys } from '../query-keys'
import type { OpBody, OpQuery } from '../types'

/** My private draft — never another member's selections. */
export function useMyPreferences(roomId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.roomPreferences(roomId ?? ''),
    queryFn: () => preferencesApi.getMyPreferences(roomId as string),
    enabled: Boolean(roomId),
  })
}

/**
 * Autosave. On a 409 the local draft is behind: refetch, merge, retry — the
 * caller decides, this hook only refreshes the server version.
 */
export function useSaveMyPreferences(roomId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: OpBody<'saveMyPreferences'>) => preferencesApi.saveMyPreferences(roomId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.roomPreferences(roomId) })
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.roomPreferences(roomId) })
    },
  })
}

export function useCompleteMyPreferences(roomId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => preferencesApi.completeMyPreferences(roomId),
    onSuccess: () => {
      // Completion can flip the room to `matching` and changes member progress.
      void queryClient.invalidateQueries({ queryKey: queryKeys.room(roomId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.roomPreferences(roomId) })
    },
  })
}

/**
 * Taxonomy is public, static-ish reference data: stable keys plus locale
 * labels. Cached long because it only changes when the CMS publishes.
 */
export function useTaxonomies(query?: OpQuery<'listTaxonomies'>) {
  return useQuery({
    queryKey: queryKeys.taxonomies(query?.kinds),
    queryFn: () => preferencesApi.listTaxonomies(query),
    staleTime: 60 * 60 * 1000,
  })
}

/**
 * Resolves a stable taxonomy key to a locale label. Business data stores the
 * key (`cafe`, `romantic`); only this turns it into "Cafe" / "Lãng mạn"
 * (RULE-CORE-002). Falls back to the key rather than rendering nothing — a
 * blank chip hides a real gap.
 */
export function useTaxonomyLabel(kinds?: string) {
  const { i18n } = useTranslation()
  const taxonomies = useTaxonomies(kinds ? { kinds } : undefined)

  const resolve = useCallback(
    (kind: string, key: string): string => {
      const entry = taxonomies.data?.kinds?.[kind]?.find(candidate => candidate.key === key)
      return entry?.labels?.[i18n.language] ?? entry?.labels?.vi ?? key
    },
    [taxonomies.data, i18n.language],
  )

  return { resolve, isPending: taxonomies.isPending }
}
