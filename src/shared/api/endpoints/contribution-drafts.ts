import { api } from '../client'
import type { OpBody, OpResponse } from '../types'

export const listContributionDrafts = () =>
  api.get<OpResponse<'listPlaceContributionDrafts'>>('/place-contribution-drafts')
export const getContributionDraft = (id: string) =>
  api.get<OpResponse<'getPlaceContributionDraft'>>('/place-contribution-drafts/{id}', { pathParams: { id } })
export const saveContributionDraft = (id: string, body: OpBody<'savePlaceContributionDraft'>) =>
  api.put<OpResponse<'savePlaceContributionDraft'>>('/place-contribution-drafts/{id}', body, { pathParams: { id } })
export const deleteContributionDraft = (id: string, version: number) =>
  api.delete<OpResponse<'deletePlaceContributionDraft'>>('/place-contribution-drafts/{id}', undefined, {
    pathParams: { id },
    query: { version },
  })
