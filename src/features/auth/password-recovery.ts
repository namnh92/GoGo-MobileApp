import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { create } from 'zustand'
import { requestPasswordRecovery } from '@/shared/api/endpoints/password-recovery'
import { ApiError, isOffline } from '@/shared/api/errors'
import { newIdempotencyKey } from '@/shared/api/idempotency'
import type { OpResponse } from '@/shared/api/types'
import type { MessageKey } from '@/shared/i18n/types'

// Transient navigation state only: no persistence, URL parameters or analytics.
export type RecoveryFlow = OpResponse<'requestPasswordRecovery'> & { email: string; next?: string }
export const useRecoveryFlow = create<{ flow: RecoveryFlow | null; setFlow: (flow: RecoveryFlow | null) => void }>(set => ({
  flow: null,
  setFlow: flow => set({ flow }),
}))

type RequestHistory = { times: number[]; retryAt: number }
// Session-only quota history survives leaving either recovery screen.
export const useRecoveryRequests = create<{ emails: Record<string, RequestHistory> }>(() => ({ emails: {} }))
const emailKey = (email: string) => email.trim().toLowerCase()
export function recoveryRequestDeadline(email: string, now = Date.now()) {
  const history = useRecoveryRequests.getState().emails[emailKey(email)]
  if (!history) return 0
  const times = history.times.filter(time => time > now - 3_600_000)
  return Math.max(history.retryAt, (times.at(-1) ?? -60_000) + 60_000, times.length >= 3 ? times[times.length - 3] + 3_600_000 : 0)
}

function blockRecoveryRequests(email: string, retryAt: number) {
  const key = emailKey(email)
  const history = useRecoveryRequests.getState().emails[key] ?? { times: [], retryAt: 0 }
  useRecoveryRequests.setState(state => ({ emails: { ...state.emails, [key]: { ...history, retryAt: Math.max(history.retryAt, retryAt) } } }))
}

export function useRecoveryRequest() {
  return useRecoveryMutation(async (body: { email: string }, key: string) => {
    const requestedAt = Date.now()
    const deadline = recoveryRequestDeadline(body.email, requestedAt)
    if (deadline > requestedAt) throw new ApiError(429, { code: 'RATE_LIMITED', message: 'Recovery request cooldown' }, String((deadline - requestedAt) / 1000))
    const email = emailKey(body.email)
    const history = useRecoveryRequests.getState().emails[email]
    useRecoveryRequests.setState(state => ({ emails: { ...state.emails, [email]: {
      times: [...(history?.times ?? []).filter(time => time > requestedAt - 3_600_000), requestedAt], retryAt: 0,
    } } }))
    try {
      const challenge = await requestPasswordRecovery(body, key)
      blockRecoveryRequests(email, Date.parse(challenge.resendAvailableAt) || 0)
      return { ...challenge, expiresAt: Number.isFinite(Date.parse(challenge.expiresAt)) ? challenge.expiresAt : new Date(requestedAt + 300_000).toISOString() }
    } catch (error) {
      blockRecoveryRequests(email, recoveryRetryAt(error))
      throw error
    }
  })
}

export function useRecoveryRequestCountdown(email: string) {
  useRecoveryRequests(state => state.emails)
  // Recompute the rolling window as requests age out.
  return useRecoveryCountdown(recoveryRequestDeadline(email))
}

export function maskRecoveryEmail(email: string) {
  const [local, domain] = email.split('@')
  return `${local.slice(0, 1)}***@${domain}`
}

export function recoveryErrorKey(error: unknown): MessageKey {
  if (isOffline(error)) return 'auth.networkError'
  if (error instanceof ApiError) {
    if (error.status === 404 && error.code === 'RECOVERY_ACCOUNT_NOT_FOUND') return 'auth.recovery.accountNotFound'
    if (error.status === 429) return 'auth.recovery.rateLimited'
    if (error.code === 'RECOVERY_MAIL_NOT_CONFIGURED') return 'auth.recovery.mailNotConfigured'
    if (error.status === 503) return 'auth.recovery.unavailable'
    if (error.code === 'RECOVERY_INVALID') return 'auth.recovery.invalidCode'
    if (error.fieldErrors.some(field => field.field === 'password')) return 'auth.passwordInvalid'
  }
  return 'auth.genericError'
}

export function recoveryRetryAt(error: unknown) {
  return error instanceof ApiError && error.status === 429 ? (error.retryAt || Date.now() + 60_000) : 0
}

/** Deadline-based, including foreground resume; never decrements a stale counter. */
export function useRecoveryCountdown(deadline: number) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const tick = () => setNow(Date.now())
    tick()
    const timer = setInterval(tick, 1000)
    const listener = AppState.addEventListener('change', tick)
    return () => { clearInterval(timer); listener.remove() }
  }, [deadline])
  return Math.max(0, Math.ceil((deadline - now) / 1000))
}

export function formatRecoveryCountdown(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** Keep ambiguous network retries on the same intent, including manual retry. */
export function useRecoveryMutation<T, R>(action: (body: T, key: string) => Promise<R>) {
  const intent = useRef<{ body: string; key: string } | null>(null)
  useEffect(() => () => { intent.current = null }, [])
  return useMutation({
    retry: false, // Quotas also count replayed attempts; retries are explicit.
    networkMode: 'always',
    gcTime: 0, // Do not retain password/code in the mutation cache after unmount.
    mutationFn: async (body: T) => {
      const serialized = JSON.stringify(body)
      if (intent.current?.body !== serialized) intent.current = { body: serialized, key: newIdempotencyKey() }
      try {
        const result = await action(body, intent.current.key)
        intent.current = null
        return result
      } catch (error) {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 429) intent.current = null
        throw error
      }
    },
  })
}
