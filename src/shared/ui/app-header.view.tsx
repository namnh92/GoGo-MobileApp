import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, View, type AccessibilityRole, type AccessibilityState } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { HeaderNotificationButton } from './header-notification-button.view'
import { MaterialIcon } from './material-icon'
import { Text } from './text'
import { styles } from './app-header.style'

export type AppHeaderProps = {
  /** Sheets/modals retain local actions and omit notification navigation. */
  variant?: 'tab-root' | 'sub-screen' | 'sheet'
  /** Profile sub-screens omit inbox navigation while keeping local actions. */
  showNotifications?: boolean
  title: string
  subtitle?: string
  subtitleTone?: 'default' | 'danger'
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
export function AppHeader({ variant = 'sub-screen', showNotifications = true, title, subtitle, subtitleTone = 'default', onBack, backDisabled = false, backLabel, backTestID, safeArea = true, rightAction, titleAccessory, leading, testID = 'app-header', bellTestID = `${testID}-bell`, unreadDotTestID = `${testID}-unread-dot` }: AppHeaderProps) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const back = onBack ? <AppHeaderAction accessibilityLabel={backLabel ?? t('common.back')} testID={backTestID} onPress={onBack} disabled={backDisabled}><MaterialIcon name="arrowBack" size={24} /></AppHeaderAction> : null
  const actions = <>{rightAction}{variant !== 'sheet' && showNotifications ? <HeaderNotificationButton testID={bellTestID} unreadDotTestID={unreadDotTestID} /> : null}</>
  return <View testID={testID} style={[styles.root, { paddingTop: safeArea ? insets.top : 0, paddingLeft: insets.left, paddingRight: insets.right }]}>
    <View style={[styles.row, variant !== 'tab-root' && styles.subScreenRow]}>
      {back}{leading}
      <View style={styles.identity}>
        <View style={variant === 'tab-root' ? styles.brandRow : undefined}>
          {variant === 'tab-root' ? <><Text variant="discoveryHeading" color="accent.primary">{t('splash.brand')}</Text><Text variant="introSmall" color="text.secondary">·</Text></> : null}
          <Text variant="introHeading" color="text.primary" accessibilityRole="header" style={styles.title}>{title}</Text>
        </View>
        {subtitle ? <Text variant="introCaption" color={subtitleTone === 'danger' ? 'status.dangerText' : 'text.secondary'} style={styles.subtitle}>{subtitle}</Text> : null}
        {titleAccessory}
      </View>
      <View style={styles.actions}>{actions}</View>
    </View>
  </View>
}

/** Optional actions share the back button's target, feedback and a11y contract. */
export function AppHeaderAction({ accessibilityLabel, children, onPress, disabled = false, testID, accessibilityRole = 'button', accessibilityState }: { accessibilityLabel: string; children: ReactNode; onPress: () => void; disabled?: boolean; testID?: string; accessibilityRole?: AccessibilityRole; accessibilityState?: AccessibilityState }) {
  return <Pressable testID={testID} accessibilityRole={accessibilityRole} accessibilityLabel={accessibilityLabel} accessibilityState={{ ...accessibilityState, disabled }} disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.disabled]}>{children}</Pressable>
}
