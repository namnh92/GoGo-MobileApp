import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { create } from 'zustand'
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

export function maskRecoveryEmail(email: string) {
  const [local, domain] = email.split('@')
  return `${local.slice(0, 1)}***@${domain}`
}

export function recoveryErrorKey(error: unknown): MessageKey {
  if (isOffline(error)) return 'auth.networkError'
  if (error instanceof ApiError) {
    if (error.status === 429) return 'auth.recovery.rateLimited'
    if (error.code === 'RECOVERY_MAIL_NOT_CONFIGURED') return 'auth.recovery.mailNotConfigured'
    if (error.status === 503) return 'auth.recovery.unavailable'
    if (error.code === 'RECOVERY_INVALID') return 'auth.recovery.invalidCode'
    if (error.fieldErrors.some(field => field.field === 'password')) return 'auth.passwordInvalid'
  }
  return 'auth.genericError'
}

export function recoveryRetryAt(error: unknown) {
  return error instanceof ApiError && error.status === 429 ? Math.max(error.retryAt, Date.now() + 60_000) : 0
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
