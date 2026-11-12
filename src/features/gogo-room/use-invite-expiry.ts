import { useEffect } from 'react'

/** Both invite surfaces stop offering a link as soon as its expiry passes. */
export function useInviteExpiry(expiresAt: number | undefined, onExpire: (now: number) => void, clock: number) {
  useEffect(() => {
    if (expiresAt === undefined) return
    const remaining = expiresAt - Date.now()
    const timer = setTimeout(() => onExpire(Date.now()), Math.min(Math.max(0, remaining), 2_147_483_647))
    return () => clearTimeout(timer)
  }, [expiresAt, onExpire, clock])
}
