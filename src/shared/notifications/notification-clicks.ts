import { notificationTarget, type NotificationTarget } from './notification-target'

/** What the SDK hands a click listener, narrowed to what routing reads. */
export type NotificationClick = {
  notification?: { notificationId?: string | null; additionalData?: unknown } | null
}

/** `queued`: the tap arrived before the app could open anything — a cold start. */
export type NotificationOpener = (target: NotificationTarget, context: { queued: boolean }) => Promise<void> | void

/** Recent notifications remembered, to drop a click event repeated for one of them. */
const REMEMBERED_NOTIFICATIONS = 20

/**
 * GoGo-MobileApp#256 — between the SDK's click event and a navigation.
 *
 * Two things go wrong without this:
 *
 *   - **cold start.** The tap that launched the app arrives before the
 *     navigator is mounted, before the launch screen has redirected, and before
 *     the session has hydrated. Navigating then is lost, or replaced by the
 *     launch redirect. The tap is held until an opener is set — the latest tap
 *     wins — and opened exactly once.
 *   - **repeats.** A listener registered twice, or an SDK that re-delivers the
 *     launch tap, reports one notification more than once. It navigates once.
 */
export function createNotificationClicks(deps: { report?: (event: string) => void } = {}) {
  const report = deps.report ?? (() => {})
  let opener: NotificationOpener | null = null
  let pending: NotificationTarget | null = null
  const seen: string[] = []

  function open(target: NotificationTarget, queued: boolean): void {
    const current = opener
    if (!current) {
      pending = target
      return
    }
    try {
      void Promise.resolve(current(target, { queued })).catch(() => report('push_click_open_failed'))
    } catch {
      report('push_click_open_failed')
    }
  }

  return {
    handleClick(event: NotificationClick | null | undefined): void {
      const notification = event?.notification ?? null
      const target = notificationTarget(notification?.additionalData, notification?.notificationId ?? null)
      if (target.key) {
        if (seen.includes(target.key)) {
          report('push_click_duplicate')
          return
        }
        seen.push(target.key)
        if (seen.length > REMEMBERED_NOTIFICATIONS) seen.shift()
      }
      open(target, false)
    },

    /** Set once navigation and session are ready; cleared when they stop being. */
    setOpener(next: NotificationOpener | null): void {
      opener = next
      if (!next || !pending) return
      const queued = pending
      pending = null
      open(queued, true)
    },
  }
}

export type NotificationClicks = ReturnType<typeof createNotificationClicks>

/** The app's one instance: the SDK listener feeds it, the root layout drains it. */
export const notificationClicks = createNotificationClicks({
  // Diagnostics only (a repeated click is expected, not a fault), so never in
  // a release build.
  report: event => {
    if (__DEV__) console.warn(event)
  },
})
