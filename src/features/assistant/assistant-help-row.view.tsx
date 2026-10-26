import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'

import { isAssistantEntryOn } from '@/shared/config/features'
import { assistantIsNew, useAssistantIntroStore } from '@/shared/store/assistantIntroStore'
import { Badge } from '@/shared/ui/badge.view'
import { Card } from '@/shared/ui/card.view'
import { IconChevronRight } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'

import { AssistantAvatar } from './assistant-avatar.view'
import { assistantHref, useAssistantAccount } from './assistant-entry'
import { styles } from './assistant-help-row.style'

/**
 * Profile › Help › GoGo AI (GoGo-MobileApp#379): a findable second home for the
 * assistant, for people who look for it in settings. Behind the gate.
 */
export function AssistantHelpSection() {
  if (!isAssistantEntryOn()) return null
  return <HelpSection />
}

function HelpSection() {
  const { t } = useTranslation()
  const router = useRouter()
  const account = useAssistantAccount()
  const intro = useAssistantIntroStore(state => (account ? state.accounts[account] : undefined))
  const isNew = account !== null && assistantIsNew(intro)
  return (
    <View style={styles.section}>
      <Text variant="label" color="text.secondary" accessibilityRole="header" style={styles.label}>
        {t('profile.help')}
      </Text>
      <Card padded={false} style={styles.card}>
        <Pressable
          testID="profile-help-assistant"
          accessibilityRole="button"
          accessibilityLabel={`${t('assistant.name')}. ${t('assistant.helpRow.body')}`}
          onPress={() => router.push(assistantHref())}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <AssistantAvatar size="md" />
          <View style={styles.text}>
            <Text variant="label">{t('assistant.name')}</Text>
            <Text variant="bodySmall" color="text.secondary">{t('assistant.helpRow.body')}</Text>
          </View>
          {isNew ? <Badge label={t('assistant.badgeNew')} /> : null}
          <IconChevronRight />
        </Pressable>
      </Card>
    </View>
  )
}
