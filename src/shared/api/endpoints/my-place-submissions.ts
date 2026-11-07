import { api } from '../client'
import type { OpResponse, components } from '../types'

export type MyPlaceSubmission = components['schemas']['MyPlaceSubmission']
export const listMyPlaceSubmissions = (cursor?: string) =>
  api.get<OpResponse<'listMyPlaceSubmissions'>>('/me/place-submissions', { query: { limit: 25, cursor } })
