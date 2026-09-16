import { OneSignal, type NotificationClickEvent } from 'react-native-onesignal'

import { notificationClicks, type NotificationClicks } from './notification-clicks'

/**
 * GoGo-MobileApp#256 — the wiring, kept thin like `bootstrap.ts`.
 *
 * Registered as soon as the SDK reports ready at app start, ahead of identity
 * login: the SDK holds the tap that launched the app until a click listener
 * exists, and routing that tap must not wait on a login round trip. Everything
 * after the event — queue, dedupe, refetch, navigate — lives in
 * `notification-clicks` and `notification-open`.
 *
 * Foreground display is untouched: no `foregroundWillDisplay` listener, so the
 * SDK's default presentation stays as it was.
 */
export function startNotificationClicks(clicks: NotificationClicks = notificationClicks): () => void {
  const listener = (event: NotificationClickEvent) => clicks.handleClick(event)
  OneSignal.Notifications.addEventListener('click', listener)
  return () => OneSignal.Notifications.removeEventListener('click', listener)
}
