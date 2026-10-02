import { focusManager, onlineManager, type QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, NetworkError } from '../errors'
import { createQueryClient } from '../query-client'

// `query-client` reaches React Native only for AppState/Platform and
// expo-network; neither is exercised here.
vi.mock('react-native', () => ({ AppState: { addEventListener: vi.fn() }, Platform: { OS: 'android' } }))
vi.mock('expo-network', () => ({ addNetworkStateListener: vi.fn(), getNetworkStateAsync: vi.fn() }))

/**
 * GoGo-MobileApp#250 — on Android a save answered 503 kept spinning for one to
 * four minutes with no error: the automatic retry did not go out until the app
 * came back to the foreground. TanStack Query pauses a retry, and the first
 * attempt, whenever `onlineManager` says offline (networkMode `online`), and
 * only a later online/focus event resumes it. A wrong or missed offline signal
 * therefore turned a retryable failure into a silent, endless wait.
 *
 * A mutation is a tap that must end in an answer. Retries are bounded (two,
 * 2 s and 4 s apart) and carry the same Idempotency-Key, so running them
 * regardless of the online signal cannot double-apply; offline, they fail fast
 * with a NetworkError the screen can show and offer to retry.
 */

const SERVICE_UNAVAILABLE = new ApiError(503, { code: 'SERVICE_UNAVAILABLE', message: 'try later' })

function execute(client: QueryClient, mutationFn: () => Promise<unknown>) {
  const mutation = client.getMutationCache().build(client, { mutationFn })
  return { mutation, result: mutation.execute(undefined) }
}

let client: QueryClient

beforeEach(() => {
  vi.useFakeTimers()
  onlineManager.setOnline(true)
  focusManager.setFocused(true)
  client = createQueryClient()
  client.mount()
})

afterEach(() => {
  client.unmount()
  onlineManager.setOnline(true)
  focusManager.setFocused(undefined)
  vi.useRealTimers()
})

describe('a mutation retry after a 503 (#250)', () => {
  it('goes out after its delay even if the device was marked offline meanwhile', async () => {
    const mutationFn = vi
      .fn()
      .mockImplementationOnce(async () => {
        // The offline signal flips (wrongly, or briefly) between the 503 and the retry.
        onlineManager.setOnline(false)
        throw SERVICE_UNAVAILABLE
      })
      .mockResolvedValueOnce({ ok: true })

    const { mutation, result } = execute(client, mutationFn)
    await vi.advanceTimersByTimeAsync(2_000)

    expect(mutationFn).toHaveBeenCalledTimes(2)
    await expect(result).resolves.toEqual({ ok: true })
    expect(mutation.state.isPaused).toBe(false)
  })

  it('ends in an error the screen can show, never a pause, when retries keep failing', async () => {
    const mutationFn = vi.fn().mockImplementation(async () => {
      onlineManager.setOnline(false)
      throw SERVICE_UNAVAILABLE
    })

    const { mutation, result } = execute(client, mutationFn)
    const settled = result.catch(error => error)
    await vi.advanceTimersByTimeAsync(2_000 + 4_000)

    expect(mutationFn).toHaveBeenCalledTimes(3)
    await expect(settled).resolves.toBe(SERVICE_UNAVAILABLE)
    expect(mutation.state.status).toBe('error')
    expect(mutation.state.isPaused).toBe(false)
  })
})

describe('a mutation tapped while the app believes it is offline (#250)', () => {
  it('runs and fails fast with a retryable error instead of waiting for a network event', async () => {
    onlineManager.setOnline(false)
    const mutationFn = vi.fn().mockRejectedValue(new NetworkError())

    const { mutation, result } = execute(client, mutationFn)
    const settled = result.catch(error => error)
    await vi.advanceTimersByTimeAsync(2_000 + 4_000)

    expect(mutationFn).toHaveBeenCalledTimes(3)
    await expect(settled).resolves.toBeInstanceOf(NetworkError)
    expect(mutation.state.isPaused).toBe(false)
  })

  it('still sends when the offline signal was wrong', async () => {
    onlineManager.setOnline(false)
    const mutationFn = vi.fn().mockResolvedValue({ ok: true })

    const { result } = execute(client, mutationFn)
    await expect(result).resolves.toEqual({ ok: true })
    expect(mutationFn).toHaveBeenCalledTimes(1)
  })
})

/**
 * #315 F-02 — what this change does NOT remove. TanStack's retryer also waits
 * while `focusManager` says the app is unfocused, whatever the network mode.
 * If the app is wrongly believed to be in the background, a retry still pauses
 * until the next focus event. Whether that is what happened on the device in
 * #250 is UNKNOWN until onlineManager/focusManager/NetInfo are captured there.
 */
describe('a mutation retry while the app is unfocused (#250, remaining)', () => {
  it('still pauses until the app is focused again', async () => {
    const mutationFn = vi
      .fn()
      .mockImplementationOnce(async () => {
        focusManager.setFocused(false)
        throw SERVICE_UNAVAILABLE
      })
      .mockResolvedValueOnce({ ok: true })

    const { mutation, result } = execute(client, mutationFn)
    await vi.advanceTimersByTimeAsync(60_000)

    expect(mutationFn).toHaveBeenCalledTimes(1)
    expect(mutation.state.isPaused).toBe(true)

    // Coming back to the foreground resumes it (QueryClient.mount → resumePausedMutations).
    focusManager.setFocused(true)
    await vi.advanceTimersByTimeAsync(0)
    await expect(result).resolves.toEqual({ ok: true })
    expect(mutationFn).toHaveBeenCalledTimes(2)
  })
})
