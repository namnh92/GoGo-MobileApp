import { api } from '../client'
import type { OpResponse, components } from '../types'

export type MyPlaceSubmission = components['schemas']['MyPlaceSubmission']
export const listMyPlaceSubmissions = (cursor?: string) =>
  api.get<OpResponse<'listMyPlaceSubmissions'>>('/me/place-submissions', { query: { limit: 25, cursor } })

export const getMyPlaceSubmission = (id: string, signal?: AbortSignal) =>
  api.get<OpResponse<'getMyPlaceSubmission'>>('/me/place-submissions/{id}', { pathParams: { id }, signal })
