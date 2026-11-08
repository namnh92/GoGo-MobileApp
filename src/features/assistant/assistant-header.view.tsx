import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AppHeader, AppHeaderAction } from '@/shared/ui/app-header.view'

import { Icon, type IconName } from '@/shared/ui/icons'

import { AssistantAvatar } from './assistant-avatar.view'

/** Shared left-title sub header; the back arrow retains the existing close action. */
export function AssistantHeader({
  onClose,
  onBack,
  title,
  subtitle,
  offline = false,
  avatar = false,
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
    <AppHeader variant="sub-screen" showNotifications={false} safeArea={false} title={title ?? t('assistant.name')} subtitle={subtitle} subtitleTone={offline ? 'danger' : 'default'}
      onBack={onBack ?? onClose} backLabel={t(onBack ? 'assistant.history.back' : 'assistant.close')} backTestID={onBack ? 'assistant-back' : 'assistant-close'}
      leading={<>
        {avatar ? <AssistantAvatar size="md" /> : null}
      </>}
      rightAction={<>
        {onNewChat ? <HeaderButton testID="assistant-new-chat" icon="newChat" label={t('assistant.newChat')} onPress={onNewChat} /> : null}
        {onHistory ? <HeaderButton testID="assistant-history" icon="history" label={t('assistant.history.open')} onPress={onHistory} /> : null}
        {trailing}
      </>} />
  )
}

function HeaderButton({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID: string }) {
  return (
    <AppHeaderAction testID={testID} accessibilityLabel={label} onPress={onPress}>
      <Icon name={icon} size={22} />
    </AppHeaderAction>
  )
}
