import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/shared/api/client'

import { RETIRE_TIMEOUT_MS, retireDeviceIdentity } from '../device-identity-api'

vi.mock('@/shared/api/client', () => ({ api: { delete: vi.fn() } }))

const del = api.delete as unknown as ReturnType<typeof vi.fn>

afterEach(() => vi.resetAllMocks())

describe('retireDeviceIdentity (D2, Sol r3 F-12)', () => {
  it('spends what is left of the retirement pass, never more than its own cap', async () => {
    del.mockResolvedValue(undefined)
    const credential = { deviceId: 'old', deviceSecret: 'old-secret' }

    await retireDeviceIdentity(credential, 500)
    expect(del).toHaveBeenLastCalledWith('/notifications/identity/device', undefined, expect.objectContaining({ timeoutMs: 500 }))

    await retireDeviceIdentity(credential, 10_000)
    expect(del).toHaveBeenLastCalledWith(expect.anything(), undefined, expect.objectContaining({ timeoutMs: RETIRE_TIMEOUT_MS }))

    await retireDeviceIdentity(credential)
    expect(del).toHaveBeenLastCalledWith(expect.anything(), undefined, expect.objectContaining({ timeoutMs: RETIRE_TIMEOUT_MS }))
  })
})
