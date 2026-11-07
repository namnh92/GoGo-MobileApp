import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as drafts from '../endpoints/contribution-drafts'
import type { OpBody } from '../types'

const key = ['place-contribution-drafts'] as const
/** Private user text stays memory-only; excluded by the query persistence allowlist. */
export function useContributionDrafts(enabled: boolean) {
  return useQuery({
    queryKey: key,
    queryFn: drafts.listContributionDrafts,
    enabled,
    gcTime: 0,
    staleTime: 0,
    retry: false,
  })
}
export function useReadContributionDraft() {
  return useMutation({ mutationFn: drafts.getContributionDraft, gcTime: 0, retry: false })
}
export function useSaveContributionDraft() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: OpBody<'savePlaceContributionDraft'> }) =>
      drafts.saveContributionDraft(id, body),
    gcTime: 0,
    retry: false,
    onSettled: () => {
      void client.invalidateQueries({ queryKey: key })
    },
  })
}
export function useDeleteContributionDraft() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => drafts.deleteContributionDraft(id, version),
    gcTime: 0,
    retry: false,
    onSettled: () => {
      void client.invalidateQueries({ queryKey: key })
    },
  })
}
