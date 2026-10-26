import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'

import { isAssistantEntryOn } from '@/shared/config/features'
import { Card } from '@/shared/ui/card.view'
import { IconChevronRight } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'

import { AssistantAvatar } from './assistant-avatar.view'
import { assistantHref } from './assistant-entry'
import { styles } from './assistant-place-card.style'


/**
 * "Questions about this place?" on place detail (GoGo-MobileApp#379). Place
 * detail has its own action bar, so the float button hides there and this
 * contextual entry takes its role. A question opens GoGo AI with the place
 * attached as a removable chip and the question carried along; the card head
 * opens it with the place only. Behind the `assistantEntry` gate.
 */
export function AssistantPlaceCard({ placeId, placeName }: { placeId: string; placeName: string }) {
  const { t } = useTranslation()
  const router = useRouter()
  if (!isAssistantEntryOn()) return null
  // Fixed copy until the assistant can suggest its own; three at most (design system).
  const questions = [
    t('assistant.placeCard.question.lateWeekend'),
    t('assistant.placeCard.question.budget'),
    t('assistant.placeCard.question.similar'),
  ]
  return (
    <Card padded={false} style={styles.card} testID="assistant-place-card">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('assistant.placeCard.title')} ${t('assistant.placeCard.body')}`}
        onPress={() => router.push(assistantHref({ placeId, placeName }))}
        style={({ pressed }) => [styles.head, pressed && styles.headPressed]}
      >
        <AssistantAvatar size="md" />
        <View style={styles.headText}>
          <Text variant="title2">{t('assistant.placeCard.title')}</Text>
          <Text variant="bodySmall" color="text.secondary">{t('assistant.placeCard.body')}</Text>
        </View>
        <IconChevronRight />
      </Pressable>
      <View style={styles.questions}>
        {questions.map(question => (
          <Pressable
            key={question}
            accessibilityRole="button"
            onPress={() => router.push(assistantHref({ placeId, placeName, question }))}
            style={({ pressed }) => [styles.question, pressed && styles.questionPressed]}
          >
            <Text variant="label" color="accent.onSoft">{question}</Text>
          </Pressable>
        ))}
      </View>
    </Card>
  )
}
