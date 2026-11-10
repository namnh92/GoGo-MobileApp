import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { candidatePhotoOptions } from '../candidate-photo'
import { api } from '../client'
import { ApiError, NetworkError } from '../errors'

vi.mock('../client', () => ({ api: { get: vi.fn() } }))
const response = { status: 'ok', attribution: 'Google Maps', photos: [{ contentType: 'image/jpeg', dataBase64: 'aGk=', authorAttributions: [{ displayName: 'Lan' }] }] }
afterEach(() => { vi.resetAllMocks(); vi.useRealTimers() })

it('a second mount and concurrent screens share one fetch by placeId', async () => {
  const client = new QueryClient()
  const options = candidatePhotoOptions('ChIJtest')
  let finish!: (value: unknown) => void
  vi.mocked(api.get).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const first = new QueryObserver(client, options)
  const second = new QueryObserver(client, options)
  const unsubscribe = first.subscribe(() => {})
  const unsubscribeSecond = second.subscribe(() => {})
  expect(api.get).toHaveBeenCalledTimes(1)
  finish(response)
  await client.fetchQuery(options)
  unsubscribe(); unsubscribeSecond()
  const remount = new QueryObserver(client, candidatePhotoOptions('ChIJtest'))
  const unsubscribeRemount = remount.subscribe(() => {})
  expect(remount.getCurrentResult().data?.uri).toBe('data:image/jpeg;base64,aGk=')
  expect(api.get).toHaveBeenCalledTimes(1)
  expect(options.staleTime).toBe(Infinity)
  expect(options.gcTime).toBe(Infinity)
  unsubscribeRemount(); client.clear()
})

it('retry configuration preserves the envelope and exponential/Retry-After delays', () => {
  vi.useFakeTimers()
  const options = candidatePhotoOptions('ChIJtest')
  const retry = options.retry as (count: number, error: Error) => boolean
  const delay = options.retryDelay as (attempt: number, error: Error) => number
  expect([0, 1, 2].map(attempt => delay(attempt, new NetworkError()))).toEqual([2000, 4000, 8000])
  expect(retry(2, new NetworkError())).toBe(true)
  expect(retry(3, new NetworkError())).toBe(false)
  expect(retry(0, new ApiError(503, { code: 'UNAVAILABLE', message: 'Unavailable', retryable: false }))).toBe(false)
  const limited = new ApiError(429, { code: 'RATE_LIMITED', message: 'Limited', retryable: true }, '10')
  expect(retry(0, limited)).toBe(true)
  expect(delay(0, limited)).toBe(10000)
})
