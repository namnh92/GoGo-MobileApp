import { useEffect, type ReactNode } from 'react'
import { AccessibilityInfo, View } from 'react-native'

import { Icon, type IconName } from '@/shared/ui/icons'
import { PrimaryBtn, SecondaryBtn } from '@/shared/ui/button.view'
import { Text } from '@/shared/ui/text'

import { styles } from './state-notice.style'

export interface NoticeAction {
  label: string
  onPress: () => void
  kind?: 'primary' | 'secondary'
  disabled?: boolean
}

/**
 * Design system `StateNotice` (GoGo-MobileApp#378): empty / error / success,
 * inline in the thread or as a screen. Title, one sentence, then the next
 * steps. An error is announced as an alert the moment it appears; the rest
 * are read in reading order.
 */
export function StateNotice({
  kind,
  title,
  body,
  actions = [],
  inline = true,
  icon,
  children,
  testID,
}: {
  kind: 'empty' | 'error' | 'success' | 'info'
  title: string
  body?: string
  actions?: NoticeAction[]
  inline?: boolean
  icon?: IconName
  children?: ReactNode
  testID?: string
}) {
  const error = kind === 'error'
  useEffect(() => {
    if (error) AccessibilityInfo.announceForAccessibility(body ? `${title}. ${body}` : title)
  }, [error, title, body])
  const glyph: IconName = icon ?? (error ? 'wifiOff' : kind === 'success' ? 'checkCircle' : 'info')
  return (
    <View
      testID={testID}
      accessibilityRole={error ? 'alert' : undefined}
      accessibilityLiveRegion={error ? 'assertive' : 'none'}
      style={[styles.notice, inline ? styles.inline : styles.screen]}
    >
      <View style={[styles.tile, error ? styles.tileDanger : kind === 'success' ? styles.tileSuccess : styles.tileInfo]}>
        <Icon
          name={glyph}
          size={20}
          color={error ? 'status.dangerText' : kind === 'success' ? 'status.successText' : 'status.infoText'}
        />
      </View>
      <View style={inline ? styles.textInline : styles.textScreen}>
        <Text variant={inline ? 'title2' : 'title1'} style={!inline && styles.centered}>{title}</Text>
        {body ? (
          <Text variant="bodySmall" color="text.secondary" style={!inline && styles.centered}>{body}</Text>
        ) : null}
      </View>
      {children}
      {actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map(action =>
            action.kind === 'secondary' ? (
              <SecondaryBtn key={action.label} label={action.label} onPress={action.onPress} disabled={action.disabled} />
            ) : (
              <PrimaryBtn key={action.label} label={action.label} onPress={action.onPress} disabled={action.disabled} />
            ),
          )}
        </View>
      ) : null}
    </View>
  )
}
