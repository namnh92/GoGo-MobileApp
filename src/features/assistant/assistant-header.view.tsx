import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'

import { Icon, type IconName } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'

import { AssistantAvatar } from './assistant-avatar.view'
import { styles } from './assistant-header.style'

/**
 * The top bar of GoGo AI (design `AssistantHeader`, GoGo-MobileApp#379/#378).
 * Opened over the app it leads with Close (×); History leads with Back. Then
 * the avatar and "GoGo AI" with its subtitle, and at most two trailing
 * actions: New chat and History in a conversation, History on Welcome, a
 * custom one (History's "New chat") through `trailing`.
 */
export function AssistantHeader({
  onClose,
  onBack,
  title,
  subtitle,
  offline = false,
  avatar = true,
  onHistory,
  onNewChat,
  trailing,
}: {
  onClose?: () => void
  onBack?: () => void
  title?: string
  subtitle?: string
  /** Draws the subtitle as the offline status. */
  offline?: boolean
  avatar?: boolean
  onHistory?: () => void
  onNewChat?: () => void
  trailing?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <View style={styles.header}>
      {onClose ? <HeaderButton testID="assistant-close" icon="x" label={t('assistant.close')} onPress={onClose} /> : null}
      {onBack ? <HeaderButton testID="assistant-back" icon="chevronLeft" label={t('assistant.history.back')} onPress={onBack} /> : null}
      <View style={styles.identity}>
        {avatar ? <AssistantAvatar size="md" /> : null}
        <View style={styles.text}>
          <Text variant="title2" accessibilityRole="header" numberOfLines={1}>{title ?? t('assistant.name')}</Text>
          {subtitle ? (
            <Text variant="caption" color={offline ? 'status.dangerText' : 'text.secondary'} numberOfLines={1}>{subtitle}</Text>
          ) : null}
        </View>
      </View>
      {onNewChat ? <HeaderButton testID="assistant-new-chat" icon="newChat" label={t('assistant.newChat')} onPress={onNewChat} /> : null}
      {onHistory ? <HeaderButton testID="assistant-history" icon="history" label={t('assistant.history.open')} onPress={onHistory} /> : null}
      {trailing}
    </View>
  )
}

function HeaderButton({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <Icon name={icon} size={22} />
    </Pressable>
  )
}
