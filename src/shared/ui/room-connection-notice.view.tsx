import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AccessibilityInfo, Platform, View, type StyleProp, type ViewStyle } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'

import { isOffline, type RoomRealtimeStatus } from '@/shared/api'
import { useOnlineStatus } from '@/shared/api/queries/use-online-status'
import { useAppForeground } from '@/shared/hooks/use-app-foreground'
import { StaleNotice } from '@/shared/ui/async-state.view'
import { IconClock, IconInfo } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'

import { styles } from './room-connection-notice.style'

/**
 * How long `connecting` must last before it is shown (#292). A normal stream
 * handshake finishes well inside it, so the notice does not flash on every
 * screen open; a stream that keeps failing to connect still gets said.
 */
export const CONNECTING_NOTICE_DELAY_MS = 1500

type Shown = 'stale' | 'polling' | 'connecting' | null

/**
 * The one notice a room screen shows about how fresh it is (GoGo-MobileApp#292).
 * One slot, one message, in priority order:
 *
 * 1. offline, and 2. a failed refresh of cached data — `StaleNotice`, unchanged,
 *    with its Retry online and its one-announcement-per-offline-spell;
 * 3. `polling` — updates arrive on a timer, so changes on another phone can
 *    take a while to show. Shown at once, whatever the cause (realtime switched
 *    off, a 503, a dropped stream): the user sees the same delay either way;
 * 4. `connecting` — only after `CONNECTING_NOTICE_DELAY_MS` without a break;
 * 5. `live` — nothing.
 *
 * A realtime notice describes the subscription of the screen on top, in the
 * foreground: `status` is already `offline` for a blurred screen or a missing
 * room (the hook unsubscribes), and backgrounding hides it here. It never
 * blocks anything and has no controls — reconnecting is the transport's job,
 * and a button cannot override the server switching realtime off.
 *
 * `hasData` is whether cached content is on screen. Without it the screen's own
 * full-screen offline/error state speaks, and only the realtime part remains.
 */
export function RoomConnectionNotice({
  roomId,
  status,
  error = null,
  onRetry,
  hasData = true,
  visible = true,
  style,
}: {
  roomId: string | undefined
  status: RoomRealtimeStatus
  error?: unknown
  onRetry?: () => void
  hasData?: boolean
  /**
   * Whether this screen is the one on top. A stack keeps screens behind it
   * mounted; they must not speak (#327 F-03).
   */
  visible?: boolean
  /** Layout only, for a notice placed inside an already padded surface. */
  style?: StyleProp<ViewStyle>
}) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const online = useOnlineStatus()
  const foreground = useAppForeground()

  // Out of sight — backgrounded, or a screen under the one on top — nothing
  // renders, so nothing announces. The offline announcement is once per spell
  // app-wide, so a spell that starts out of sight is spoken when the notice is
  // seen, instead of being used up in the background (#327 F-03).
  const seen = visible && foreground
  const offline = !online || isOffline(error)
  const stale = seen && hasData && (offline || Boolean(error))
  const realtime = seen && !stale && !offline && (status === 'polling' || status === 'connecting') ? status : null

  // The delay restarts with every interruption — a status change, another
  // room, blur, background, unmount — so separate short handshakes never add up.
  const connectingKey = realtime === 'connecting' ? (roomId ?? '') : null
  const [connectingShownFor, setConnectingShownFor] = useState<string | null>(null)
  useEffect(() => {
    if (connectingKey === null) return
    const timer = setTimeout(() => setConnectingShownFor(connectingKey), CONNECTING_NOTICE_DELAY_MS)
    return () => {
      clearTimeout(timer)
      setConnectingShownFor(null)
    }
  }, [connectingKey])

  const shown: Shown = stale
    ? 'stale'
    : realtime === 'polling'
      ? 'polling'
      : connectingKey !== null && connectingShownFor === connectingKey
        ? 'connecting'
        : null

  const message =
    shown === 'polling' ? t('roomRealtime.polling') : shown === 'connecting' ? t('roomRealtime.connecting') : null
  useRealtimeAnnouncement(message)

  if (shown === 'stale') return <StaleNotice error={error} onRetry={onRetry} hasData={hasData} style={style} />
  if (!message) return null

  const polling = shown === 'polling'
  return (
    <View
      testID="room-connection-notice"
      // Android speaks a polite live region; iOS has none, so it gets the
      // queued announcement below instead — never both.
      accessibilityLiveRegion="polite"
      style={[styles.bar, polling ? styles.polling : styles.connecting, style]}
    >
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {polling ? <IconInfo color={theme.status.infoText} /> : <IconClock color={theme.text.secondary} />}
      </View>
      <Text variant="bodySmall" color={polling ? 'status.infoText' : 'text.primary'} style={styles.label}>
        {message}
      </Text>
    </View>
  )
}

/**
 * VoiceOver hears each realtime notice once, when it appears or changes. Queued,
 * so it never cuts off what is being read (a vote, the matching progress).
 * Android is covered by the live region on the bar itself.
 */
function useRealtimeAnnouncement(message: string | null) {
  useEffect(() => {
    if (!message || Platform.OS !== 'ios') return
    if (typeof AccessibilityInfo.announceForAccessibilityWithOptions === 'function') {
      AccessibilityInfo.announceForAccessibilityWithOptions(message, { queue: true })
    } else {
      AccessibilityInfo.announceForAccessibility(message)
    }
  }, [message])
}
