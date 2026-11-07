import { describe, expect, it, vi } from 'vitest'
import { api } from '../client'
import { listMyPlaceSubmissions } from '../endpoints/my-place-submissions'
import { shouldPersistQuery } from '../persist-policy'

vi.mock('../client', () => ({ api: { get: vi.fn() } }))
describe('private contributions transport', () => {
  it('reads first and cursor pages through the authenticated BFF without invented status parameters', async () => {
    await listMyPlaceSubmissions()
    await listMyPlaceSubmissions('opaque+cursor')
    expect(api.get).toHaveBeenNthCalledWith(1, '/me/place-submissions', { query: { limit: 25, cursor: undefined } })
    expect(api.get).toHaveBeenNthCalledWith(2, '/me/place-submissions', { query: { limit: 25, cursor: 'opaque+cursor' } })
    expect(shouldPersistQuery(['my-place-submissions'])).toBe(false)
  })
})
