import { RefreshControl, View, type RefreshControlProps } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { LoadingIndicator } from './loading-indicator.view'
import { styles } from './loading-indicator.style'

/** RN's iOS/Android refresh controls cannot host custom SVG content. Keep their
 * native gesture/accessibility behaviour, tint them, and pair with the header. */
export function ThemedRefreshControl(props: Pick<RefreshControlProps, 'refreshing' | 'onRefresh' | 'enabled'>) {
  const { theme } = useUnistyles()
  return <RefreshControl {...props} tintColor={theme.accent.primary} colors={[theme.accent.primary]} progressBackgroundColor={theme.surface.card} />
}

export function RefreshIndicatorHeader({ refreshing }: { refreshing: boolean }) {
  return refreshing ? <View style={styles.refreshHeader}><LoadingIndicator testID="refresh-loading-indicator" /></View> : null
}
