import { cloneElement, useEffect, useRef, useState, type ReactElement } from 'react'
import { Platform, RefreshControl, View } from 'react-native'
import { LoadingIndicator } from './loading-indicator.view'
import { loadingIndicator } from './tokens'
import { styles } from './refresh-control.style'

/** Native gestures on both platforms; only the GoGo mark is visible. The mark
 * stays above the list rather than scrolling away with its first row. */
export function PullToRefresh({ children, onRefresh, refreshing = false, enabled = true }: {
  children: ReactElement<{ refreshControl?: ReactElement; alwaysBounceVertical?: boolean }>
  onRefresh: () => Promise<unknown>
  refreshing?: boolean
  enabled?: boolean
}) {
  const [pulling, setPulling] = useState(false)
  const inFlight = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const busy = pulling || refreshing
  async function refresh() {
    if (!enabled || inFlight.current || refreshing) return
    inFlight.current = true
    setPulling(true)
    try { await onRefresh() } finally {
      inFlight.current = false
      if (mounted.current) setPulling(false)
    }
  }
  return <View style={styles.container}>
    {cloneElement(children, {
      alwaysBounceVertical: true,
      refreshControl: <RefreshControl refreshing={busy} enabled={enabled}
        onRefresh={() => { void refresh().catch(() => {}) }}
        // Android wraps the entire scroll view in RefreshControl and replaces
        // its style. Move its native circle (including elevation) offscreen;
        // opacity is safe only for iOS's separate UIRefreshControl child.
        progressViewOffset={Platform.OS === 'android' ? -loadingIndicator.size * 4 : 0}
        style={Platform.OS === 'ios' ? styles.native : undefined}
        tintColor="transparent" colors={['transparent']} progressBackgroundColor="transparent" />,
    })}
    {busy ? <View pointerEvents="none" style={styles.indicator}>
      <LoadingIndicator testID="refresh-loading-indicator" />
    </View> : null}
  </View>
}
