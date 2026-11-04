import { api } from '@/shared/api/client'
import { ApiError } from '@/shared/api/errors'
import type { OpBody, OpResponse } from '@/shared/api/types'

import type { DeviceCredential } from './device-credential-store'
import type { IdentityToken } from './identity-session'

/**
 * GoGo-MobileApp#398 — the four device routes (GoGo-BE ADR-0038), each answer
 * reduced to what the device does next. Credentials and tokens stay in the return
 * value; nothing here logs.
 */

/** The DELETE at sign-in must not hold the sign-in up (shape D2). */
export const RETIRE_TIMEOUT_MS = 2_000

const GONE = 'PUSH_DEVICE_IDENTITY_GONE'
const DISABLED = 'PUSH_DEVICE_IDENTITY_DISABLED'
const MALFORMED = 'DEVICE_CREDENTIAL_REQUIRED'

export type DeviceCredentialFailure =
  /** Discard and create anew. */
  | { kind: 'gone' }
  /** Flag off: discard, no new identity until the next launch. */
  | { kind: 'disabled' }
  /** 401. The client sent no well-formed credential: a bug, not GONE. */
  | { kind: 'malformed' }
  /** 429, 5xx, offline. Try again at the next trigger. */
  | { kind: 'error' }

export type DeviceCreateOutcome =
  | { kind: 'ok'; credential: DeviceCredential; token: IdentityToken }
  | { kind: 'disabled' }
  | { kind: 'unavailable' }
  | { kind: 'error' }

export type DeviceRenewOutcome =
  | { kind: 'ok'; token: IdentityToken }
  | { kind: 'unavailable' }
  | DeviceCredentialFailure

export type DeviceReportOutcome =
  | { kind: 'ok'; result: OpResponse<'reportPushDeviceSubscription'> }
  /** A newer choice is stored. `storedVersion` is null when the answer did not say. */
  | { kind: 'stale'; storedVersion: number | null }
  /** The record changed during verification. Nothing written; report again. */
  | { kind: 'conflict' }
  /** The provider does not (yet) show this subscription on this identity, or enabled. */
  | { kind: 'not_confirmed' }
  | DeviceCredentialFailure

export type DeviceRetireOutcome = { kind: 'done' } | { kind: 'malformed' } | { kind: 'error' }

export type DeviceSubscriptionReport = OpBody<'reportPushDeviceSubscription'>

const header = (credential: DeviceCredential) => `${credential.deviceId}.${credential.deviceSecret}`

function credentialFailure(error: unknown): DeviceCredentialFailure {
  if (error instanceof ApiError) {
    if (error.code === GONE) return { kind: 'gone' }
    if (error.code === DISABLED) return { kind: 'disabled' }
    if (error.code === MALFORMED) return { kind: 'malformed' }
  }
  return { kind: 'error' }
}

export async function createDeviceIdentity(): Promise<DeviceCreateOutcome> {
  try {
    const body = await api.post<OpResponse<'createPushDeviceIdentity'>>('/notifications/identity/device', undefined, {
      anonymous: true,
    })
    return {
      kind: 'ok',
      credential: { deviceId: body.deviceId, deviceSecret: body.deviceSecret },
      token: { externalId: body.externalId, token: body.token, expiresAt: body.expiresAt },
    }
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === DISABLED) return { kind: 'disabled' }
      if (error.code === 'PUSH_IDENTITY_UNAVAILABLE') return { kind: 'unavailable' }
    }
    return { kind: 'error' }
  }
}

export async function renewDeviceToken(credential: DeviceCredential): Promise<DeviceRenewOutcome> {
  try {
    const token = await api.post<OpResponse<'renewPushDeviceToken'>>('/notifications/identity/device/token', undefined, {
      deviceCredential: header(credential),
    })
    return { kind: 'ok', token }
  } catch (error) {
    if (error instanceof ApiError && error.code === 'PUSH_IDENTITY_UNAVAILABLE') return { kind: 'unavailable' }
    return credentialFailure(error)
  }
}

export async function reportDeviceSubscription(
  credential: DeviceCredential,
  body: DeviceSubscriptionReport,
): Promise<DeviceReportOutcome> {
  try {
    const result = await api.put<OpResponse<'reportPushDeviceSubscription'>>('/notifications/device-subscriptions', body, {
      deviceCredential: header(credential),
    })
    return { kind: 'ok', result }
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === 'PUSH_PREFERENCE_STALE') {
        const stored = Number(error.fieldErrors[0]?.message)
        return { kind: 'stale', storedVersion: Number.isInteger(stored) && stored >= 0 ? stored : null }
      }
      if (error.code === 'PUSH_SUBSCRIPTION_CONFLICT') return { kind: 'conflict' }
      if (error.code === 'PUSH_SUBSCRIPTION_NOT_CONFIRMED') return { kind: 'not_confirmed' }
    }
    return credentialFailure(error)
  }
}

export async function retireDeviceIdentity(credential: DeviceCredential): Promise<DeviceRetireOutcome> {
  try {
    await api.delete<OpResponse<'retirePushDeviceIdentity'>>('/notifications/identity/device', undefined, {
      deviceCredential: header(credential),
      timeoutMs: RETIRE_TIMEOUT_MS,
    })
    return { kind: 'done' }
  } catch (error) {
    const failure = credentialFailure(error)
    if (failure.kind === 'gone') return { kind: 'done' }
    return failure.kind === 'malformed' ? { kind: 'malformed' } : { kind: 'error' }
  }
}
