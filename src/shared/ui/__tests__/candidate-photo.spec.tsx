import { render } from './query-render'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode, useEffect } from 'react'
import { act, cleanup, render as nativeRender, screen } from '@testing-library/react-native'
import '@/shared/i18n'
import { api } from '@/shared/api/client'
import { ApiError, NetworkError } from '@/shared/api/errors'
import { useCandidatePhoto } from '@/shared/api/candidate-photo'
import { PlaceCardLarge } from '../place-card-large.view'
import { ContributionPlaceCard } from '../contribution-place-card.view'

jest.mock('@/shared/api/client', () => ({ api: { get: jest.fn() } }))
jest.mock('expo-image', () => ({ Image: jest.requireActual('react-native').Image }))
const get = jest.mocked(api.get)
const candidate = {
  name: 'Preview café', googlePlaceId: 'ChIJtest',
  photo: { provider: 'google' as const, url: '/v1/places/google-provider-photo/ChIJtest', attribution: 'Google Maps', authorAttributions: [], googleMapsUri: null },
  attributions: ['Google Maps'],
}
const response = { status: 'ok', attribution: 'Google Maps', photos: [{ contentType: 'image/jpeg', dataBase64: 'aGk=', authorAttributions: [{ displayName: 'Lan' }] }] }
const limited = (retryable = true) => new ApiError(429, { code: 'RATE_LIMITED', message: 'Limited', retryable })
const card = () => <ContributionPlaceCard preview={candidate} status="pending" />
const noCredit = () => {
  expect(screen.queryByTestId('contribution-photo-credit')).toBeNull()
  expect(screen.queryByText('Google Maps')).toBeNull()
}
const skeleton = () => expect(screen.getByTestId('contribution-photo-fetch-loading', { includeHiddenElements: true })).toBeTruthy()

beforeEach(() => { jest.useFakeTimers(); get.mockReset() })
async function flush() { await act(async () => { await jest.advanceTimersByTimeAsync(0) }) }

const renderPhoto = render
async function renderWithNotifications(...args: Parameters<typeof renderPhoto>) {
  const view = await renderPhoto(...args)
  await flush()
  return view
}

afterEach(async () => { await cleanup(); await act(async () => {}); jest.clearAllTimers(); jest.useRealTimers() })

it('shares one pending request between hook instances and reuses a settled photo on a second mount of the same placeId', async () => {
  let resolve!: (value: unknown) => void
  get.mockImplementationOnce(() => new Promise(done => { resolve = done }))
  function Preview() { useCandidatePhoto(candidate); return null }
  const client = new QueryClient()
  const view = await renderWithNotifications(<><Preview /><Preview /></>, client)
  expect(get).toHaveBeenCalledTimes(1)
  await view.rerender(<><Preview /><Preview /></>)
  expect(get).toHaveBeenCalledTimes(1)
  await act(async () => resolve(response))
  await view.unmount()
  get.mockResolvedValue(response)
  await renderWithNotifications(<Preview />, client)
  expect(get).toHaveBeenCalledTimes(1)
})

it('shares the request through StrictMode effect cleanup/setup replay', async () => {
  const setup = jest.fn()
  get.mockImplementation(() => new Promise(() => {}))
  function Preview() {
    useCandidatePhoto(candidate)
    useEffect(() => { setup() }, [])
    return null
  }
  await nativeRender(<StrictMode><QueryClientProvider client={new QueryClient()}><Preview /></QueryClientProvider></StrictMode>)
  expect(setup).toHaveBeenCalledTimes(2)
  expect(get).toHaveBeenCalledTimes(1)
  expect(get.mock.calls[0][1]?.signal?.aborted).not.toBe(true)
})

it('keeps the skeleton without lone credits for 429, then renders photo and author after backoff', async () => {
  get.mockRejectedValueOnce(limited()).mockResolvedValueOnce(response)
  await renderWithNotifications(card())
  skeleton(); noCredit()
  await act(async () => { await jest.advanceTimersByTimeAsync(1999) })
  expect(get).toHaveBeenCalledTimes(1)
  await act(async () => { await jest.advanceTimersByTimeAsync(1) })
  expect(get).toHaveBeenCalledTimes(2)
  expect(screen.getByTestId('import-candidate-photo')).toBeTruthy()
  expect(screen.getByTestId('contribution-photo-credit')).toHaveTextContent('Ảnh: Lan · Google Maps')
  expect(screen.queryByTestId('contribution-photo-fetch-loading', { includeHiddenElements: true })).toBeNull()
})

it('bounds transient retries to 2s, 4s, 8s and keeps the skeleton without credits after exhaustion', async () => {
  get.mockRejectedValue(new NetworkError())
  await renderWithNotifications(card())
  for (const delay of [2000, 4000, 8000]) {
    skeleton(); noCredit()
    await act(async () => { await jest.advanceTimersByTimeAsync(delay) })
  }
  expect(get).toHaveBeenCalledTimes(4)
  await act(async () => { await jest.advanceTimersByTimeAsync(60000) })
  expect(get).toHaveBeenCalledTimes(4)
  skeleton(); noCredit()
})

it.each([
  ['429 retryable:false', limited(false)],
  ['404', new ApiError(404, { code: 'NOT_FOUND', message: 'Missing', retryable: false })],
])('uses the placeholder without credits or retries when the envelope is permanent (%s)', async (_label, error) => {
  get.mockRejectedValue(error)
  await renderWithNotifications(card())
  await act(async () => { await jest.advanceTimersByTimeAsync(20000) })
  expect(get).toHaveBeenCalledTimes(1)
  noCredit()
  expect(screen.queryByTestId('contribution-photo-fetch-loading', { includeHiddenElements: true })).toBeNull()
  expect(screen.getByTestId('place-photo-placeholder', { includeHiddenElements: true })).toBeTruthy()
})

it.each(['disabled', 'no_photo'])('uses the placeholder without credits for %s', async status => {
  get.mockResolvedValue({ status, photos: [], attribution: 'Google Maps' })
  await renderWithNotifications(card())
  noCredit()
  expect(get).toHaveBeenCalledTimes(1)
  expect(screen.queryByTestId('contribution-photo-fetch-loading', { includeHiddenElements: true })).toBeNull()
})

it('honours Retry-After and stops retries when the display unmounts', async () => {
  get.mockRejectedValueOnce(new ApiError(429, { code: 'RATE_LIMITED', message: 'Limited', retryable: true }, '10')).mockResolvedValue(response)
  const view = await renderWithNotifications(card())
  await act(async () => { await jest.advanceTimersByTimeAsync(9999) })
  expect(get).toHaveBeenCalledTimes(1)
  await view.unmount()
  await act(async () => { await jest.advanceTimersByTimeAsync(20000) })
  expect(get).toHaveBeenCalledTimes(1)
})

it('also keeps the shared skeleton and omits credits on a standard preview card while retrying', async () => {
  get.mockRejectedValue(limited())
  await renderWithNotifications(<PlaceCardLarge preview={candidate} />)
  skeleton()
  expect(screen.queryByTestId('import-photo-credit')).toBeNull()
  expect(screen.queryByText('Google Maps')).toBeNull()
})
