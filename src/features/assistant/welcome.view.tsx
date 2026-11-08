import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, View } from 'react-native'

import { Text } from '@/shared/ui/text'
import { Icon } from '@/shared/ui/icons'

import { AssistantAvatar } from './assistant-avatar.view'
import { FollowUps } from './follow-ups.view'
import { SuggestionCard } from './suggestion-card.view'
import { styles } from './welcome.style'

/**
 * Design `ScreenWelcome` (GoGo-MobileApp#378): the large avatar, the greeting
 * in `display`, one line in `text.secondary`, and the four starting points in
 * a stacked list. Opened about a place (`ScreenEntryOpen`), it asks about that
 * place instead and offers the place card's starter questions.
 */
export function Welcome({
  placeName,
  onAsk,
  disabled,
  notice,
}: {
  placeName: string | null
  onAsk: (text: string) => void
  disabled: boolean
  /**
   * Why sending is off (daily limit, unavailable). Part of the scrolling
   * content, above the starting points it explains — drawn under the scroll
   * view it squeezed the 2 × 2 grid and covered the cards (acceptance BUG4).
   */
  notice?: ReactNode
}) {
  const { t } = useTranslation()
  if (placeName) {
    const questions = [
      t('assistant.placeCard.question.lateWeekend'),
      t('assistant.placeCard.question.budget'),
      t('assistant.placeCard.question.similar'),
    ]
    return (
      <ScrollView testID="assistant-welcome" contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text variant="title1" accessibilityRole="header">{t('assistant.welcome.contextTitle', { name: placeName })}</Text>
        <Text variant="body" color="text.secondary">{t('assistant.welcome.contextBody')}</Text>
        {notice ? <View testID="assistant-welcome-notice">{notice}</View> : null}
        <FollowUps
          label={t('assistant.welcome.tryAsking')}
          items={questions.map(question => ({ label: question, text: question }))}
          onSelect={onAsk}
          disabled={disabled}
        />
      </ScrollView>
    )
  }
  const cards = [
    { icon: 'compass', title: t('assistant.suggestion.explore.title'), description: t('assistant.suggestion.explore.body') },
    { icon: 'book', title: t('assistant.suggestion.howTo.title'), description: t('assistant.suggestion.howTo.body') },
    { icon: 'search', title: t('assistant.suggestion.find.title'), description: t('assistant.suggestion.find.body') },
    { icon: 'support', title: t('assistant.suggestion.support.title'), description: t('assistant.suggestion.support.body') },
  ] as const
  return (
    <ScrollView testID="assistant-welcome" contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        <View style={styles.avatar}><AssistantAvatar size="lg" inverted /></View>
        <Text variant="display" accessibilityRole="header" style={styles.centered}>{t('assistant.coachmark.title')}</Text>
        <Text variant="body" color="text.secondary" style={styles.centered}>{t('assistant.welcome.body')}</Text>
      </View>
      {notice ? <View testID="assistant-welcome-notice">{notice}</View> : null}
      <View style={styles.section}>
        <Icon name="compass" size={20} color="accent.primary" />
        <Text variant="title2" accessibilityRole="header" style={styles.sectionTitle}>{t('assistant.welcome.helpTitle')}</Text>
        <Text variant="caption" color="text.secondary">{t('assistant.welcome.tapHint')}</Text>
      </View>
      <View style={styles.list}>
        {cards.map(card => (
          <SuggestionCard key={card.title} {...card} disabled={disabled} onPress={() => onAsk(card.title)} />
        ))}
      </View>
    </ScrollView>
  )
}
