import type { ReactNode } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, View, type AccessibilityRole, type AccessibilityState, type LayoutChangeEvent } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { HeaderNotificationButton } from './header-notification-button.view'
import { MaterialIcon } from './material-icon'
import { Text } from './text'
import { styles } from './app-header.style'

export type AppHeaderProps = {
  variant?: 'tab-root' | 'sub-screen'
  title: string
  subtitle?: string
  subtitleTone?: 'default' | 'danger'
  titleAlign?: 'left' | 'center'
  onBack?: () => void
  backDisabled?: boolean
  backLabel?: string
  backTestID?: string
  /** The enclosing native modal already applies its safe area. */
  safeArea?: boolean
  rightAction?: ReactNode
  /** Context below the title, such as the discovery area picker. */
  titleAccessory?: ReactNode
  leading?: ReactNode
  testID?: string
  bellTestID?: string
  unreadDotTestID?: string
}

/** The only application navigation bar. Screen titles are localized by callers. */
export function AppHeader({ variant = 'sub-screen', title, subtitle, subtitleTone = 'default', titleAlign = 'left', onBack, backDisabled = false, backLabel, backTestID, safeArea = true, rightAction, titleAccessory, leading, testID = 'app-header', bellTestID = `${testID}-bell`, unreadDotTestID = `${testID}-unread-dot` }: AppHeaderProps) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const [sides, setSides] = useState({ left: 0, right: 0 })
  const sideWidth = Math.max(sides.left, sides.right)
  const centered = titleAlign === 'center' && variant === 'sub-screen'
  const measureSide = (side: 'left' | 'right') => (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width
    setSides(previous => previous[side] === width ? previous : { ...previous, [side]: width })
  }
  const back = onBack ? <AppHeaderAction accessibilityLabel={backLabel ?? t('common.back')} testID={backTestID} onPress={onBack} disabled={backDisabled}><MaterialIcon name="arrowBack" size={24} /></AppHeaderAction> : null
  const actions = <>{rightAction}<HeaderNotificationButton testID={bellTestID} unreadDotTestID={unreadDotTestID} /></>
  return <View testID={testID} style={[styles.root, { paddingTop: safeArea ? insets.top : 0, paddingLeft: insets.left, paddingRight: insets.right }]}>
    <View style={[styles.row, variant === 'sub-screen' && styles.subScreenRow]}>
      {centered ? <View style={[styles.side, { minWidth: sideWidth }]}><View onLayout={measureSide('left')} style={styles.actions}>{back}{leading}</View></View> : <>{back}{leading}</>}
      <View style={styles.identity}>
        <View style={variant === 'tab-root' ? styles.brandRow : undefined}>
          {variant === 'tab-root' ? <><Text variant="discoveryHeading" color="redesign.primaryText">{t('splash.brand')}</Text><Text variant="introSmall" color="redesign.secondary">·</Text></> : null}
          <Text variant="introHeading" color="redesign.ink" accessibilityRole="header" style={[styles.title, centered && styles.centered]}>{title}</Text>
        </View>
        {subtitle ? <Text variant="introCaption" color={subtitleTone === 'danger' ? 'status.dangerText' : 'redesign.secondary'} style={[styles.subtitle, centered && styles.centered]}>{subtitle}</Text> : null}
        {titleAccessory}
      </View>
      {centered ? <View style={[styles.side, styles.trailing, { minWidth: sideWidth }]}><View onLayout={measureSide('right')} style={styles.actions}>{actions}</View></View> : <View style={styles.actions}>{actions}</View>}
    </View>
  </View>
}

/** Optional actions share the back button's target, feedback and a11y contract. */
export function AppHeaderAction({ accessibilityLabel, children, onPress, disabled = false, testID, accessibilityRole = 'button', accessibilityState }: { accessibilityLabel: string; children: ReactNode; onPress: () => void; disabled?: boolean; testID?: string; accessibilityRole?: AccessibilityRole; accessibilityState?: AccessibilityState }) {
  return <Pressable testID={testID} accessibilityRole={accessibilityRole} accessibilityLabel={accessibilityLabel} accessibilityState={{ ...accessibilityState, disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled]}>{children}</Pressable>
}
