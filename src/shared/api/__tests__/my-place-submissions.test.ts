import { describe, expect, it, vi } from 'vitest'
import { api } from '../client'
import { getMyPlaceSubmission, isSubmissionDetailRetryable, listMyPlaceSubmissions } from '../endpoints/my-place-submissions'
import { ApiError, NetworkError, TimeoutError } from '../errors'
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
  it('reads authorized submission DETAIL with its ID and cancellation signal', async () => {
    const { signal } = new AbortController()
    await getMyPlaceSubmission('submission-id', signal)
    expect(api.get).toHaveBeenLastCalledWith('/me/place-submissions/{id}', { pathParams: { id: 'submission-id' }, signal })
  })
})

describe('submission DETAIL retry policy', () => {
  it.each([new NetworkError(), new TimeoutError(6000), ...[500, 502, 503, 599].map(status => new ApiError(status, { code: 'UNAVAILABLE', message: 'unavailable' }))])('retries only transient transport failures: %s', error => {
    expect(isSubmissionDetailRetryable(error)).toBe(true)
  })
  it.each([new Error('unknown'), ...[400, 401, 403, 404, 408, 425, 429, 600].map(status => new ApiError(status, { code: 'REJECTED', message: 'rejected', retryable: true }))])('does not retry non-transient failures: %s', error => {
    expect(isSubmissionDetailRetryable(error)).toBe(false)
  })
})
