import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { isAssistantEntryOn } from '@/shared/config/features'
import { goBackOrHome } from '@/shared/navigation/go-back-or-home'
import { markAssistantOpened, takeChatSavedToast } from '@/shared/store/assistantIntroStore'
import { Card } from '@/shared/ui/card.view'
import { Text } from '@/shared/ui/text'
import { useToast } from '@/shared/ui/toast.view'
import { spacing } from '@/shared/ui/tokens'

import { AssistantAvatar } from './assistant-avatar.view'
import { useAssistantAccount } from './assistant-entry'
import { AssistantHeader } from './assistant-header.view'
import { ContextChip } from './context-chip.view'
import { styles } from './assistant.style'

/**
 * The shell has no conversation: chat, history and sending arrive with #378,
 * which waits on the assistant API (GoGo-BE#713). Until then nothing is saved,
 * so closing never says "Chat saved in GoGo AI history".
 */
const HAS_CHAT = false

/**
 * GoGo AI, opened from an entry point (GoGo-MobileApp#379). An iOS page sheet
 * (full screen on Android, `app/_layout.tsx`): Close (×) or a swipe down
 * returns to the screen underneath, which never unmounted, so its scroll
 * position is where it was. A shell for now — the header, the avatar, the
 * greeting and one line saying the assistant is on its way. No fake chat, no
 * network. With the gate off the route leads home.
 */
export default function AssistantScreen() {
  if (!isAssistantEntryOn()) return <Redirect href="/" />
  return <AssistantShell />
}

function AssistantShell() {
  const { t } = useTranslation()
  const router = useRouter()
  const toast = useToast()
  const insets = useSafeAreaInsets()
  const account = useAssistantAccount()
  const params = useLocalSearchParams<{ placeId?: string; placeName?: string; question?: string }>()
  const [context, setContext] = useState(
    params.placeId && params.placeName ? { placeId: params.placeId, name: params.placeName } : null,
  )
  const question = typeof params.question === 'string' && params.question ? params.question : null

  // Opening clears the "New" badge for this account.
  useEffect(() => {
    if (account) markAssistantOpened(account)
  }, [account])

  // Close (×), swipe down and Android back all unmount this screen.
  const closing = useRef({ account, toast, t })
  useEffect(() => {
    closing.current = { account, toast, t }
  }, [account, toast, t])
  useEffect(
    () => () => {
      const { account: who, toast: api, t: translate } = closing.current
      if (takeChatSavedToast(who, HAS_CHAT)) api.show(translate('assistant.chatSaved'))
    },
    [],
  )

  return (
    <View style={[styles.screen, { paddingTop: Platform.OS === 'ios' ? spacing[2] : insets.top }]}>
      <AssistantHeader onClose={() => goBackOrHome(router)} />
      <ScrollView contentContainerStyle={styles.body}>
        <AssistantAvatar size="lg" />
        <Text variant="display" style={styles.greeting}>{t('assistant.greeting')}</Text>
        <Text variant="body" color="text.secondary">{t('assistant.comingSoon')}</Text>
        {question ? (
          <Card style={styles.question}>
            <Text variant="caption" color="text.secondary">{t('assistant.yourQuestion')}</Text>
            <Text variant="body">{question}</Text>
          </Card>
        ) : null}
      </ScrollView>
      {context ? (
        <View style={[styles.context, { paddingBottom: insets.bottom + spacing[3] }]}>
          <ContextChip label={context.name} onRemove={() => setContext(null)} />
        </View>
      ) : null}
    </View>
  )
}
