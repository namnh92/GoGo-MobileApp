import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import type { AssistantPlaceCard, AssistantPlanCard, AssistantResultCard } from '@/shared/api'
import { formatRange } from '@/shared/pricing/money'
import { Badge } from '@/shared/ui/badge.view'
import { PrimaryBtn } from '@/shared/ui/button.view'
import { Icon, type IconName } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'

import { formatWhen } from './format'
import { styles } from './result-card.style'

/**
 * Design system `ResultCard` (GoGo-MobileApp#378): a place or a plan the
 * assistant found. Every fact on it is what the server read from verified
 * GoGo data (contract `AssistantPlaceCard.facts`), never model text; a place
 * that is no longer usable says so and offers nothing to do. One primary
 * action, the likely next step.
 */
export function ResultCard({
  card,
  onOpenPlace,
  onOpenPlan,
}: {
  card: AssistantResultCard
  onOpenPlace: (placeId: string) => void
  onOpenPlan: (planId: string, roomId: string) => void
}) {
  return card.kind === 'place' ? (
    <PlaceResult card={card} onOpen={onOpenPlace} />
  ) : (
    <PlanResult card={card} onOpen={onOpenPlan} />
  )
}

function Meta({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.meta}>
      <Icon name={icon} size={14} color="text.secondary" />
      <Text variant="bodySmall" color="text.secondary" style={styles.metaText}>{text}</Text>
    </View>
  )
}

function PlaceResult({ card, onOpen }: { card: AssistantPlaceCard; onOpen: (placeId: string) => void }) {
  const { t } = useTranslation()
  const { facts } = card
  const price = formatRange(facts.priceMin, facts.priceMax, facts.currency ?? 'VND')
  return (
    <View testID={`assistant-card-${card.placeId}`} style={styles.card}>
      <View style={styles.head}>
        <View style={styles.thumb}>
          <Icon name="mapPin" size={20} color="accent.onSoft" />
        </View>
        <View style={styles.titles}>
          <Text variant="title2" numberOfLines={1}>{facts.name}</Text>
          {facts.addressText ? <Text variant="bodySmall" color="text.secondary" numberOfLines={1}>{facts.addressText}</Text> : null}
        </View>
      </View>
      {card.available ? (
        <>
          {price ? <Meta icon="dollar" text={t('assistant.card.perPerson', { price })} /> : null}
          {facts.gogoRating != null && facts.gogoRatingCount ? (
            <Meta icon="star" text={t('assistant.card.rating', { rating: facts.gogoRating.toFixed(1), count: facts.gogoRatingCount })} />
          ) : null}
          {facts.openNow != null ? (
            <View style={styles.badges}>
              <Badge tone={facts.openNow ? 'success' : 'neutral'} label={facts.openNow ? t('assistant.card.openNow') : t('assistant.card.closedNow')} />
            </View>
          ) : null}
          <PrimaryBtn label={t('assistant.card.viewPlace')} onPress={() => onOpen(card.placeId)} />
        </>
      ) : (
        <View style={styles.badges}>
          <Badge tone="warning" label={t('assistant.card.unavailable')} />
        </View>
      )}
    </View>
  )
}

function PlanResult({ card, onOpen }: { card: AssistantPlanCard; onOpen: (planId: string, roomId: string) => void }) {
  const { t, i18n } = useTranslation()
  const { facts } = card
  const audience =
    facts.roomType === 'couple'
      ? t('assistant.audience.couple')
      : t('assistant.audience.group', { count: facts.participantCount ?? 0 })
  return (
    <View testID={`assistant-card-${card.planId}`} style={styles.card}>
      <View style={styles.head}>
        <View style={styles.thumb}>
          <Icon name="calendar" size={20} color="accent.onSoft" />
        </View>
        <View style={styles.titles}>
          <Text variant="title2" numberOfLines={1}>{facts.roomTitle ?? audience}</Text>
          <Text variant="bodySmall" color="text.secondary" numberOfLines={1}>{audience}</Text>
        </View>
      </View>
      {card.available ? (
        <>
          {facts.startAt ? <Meta icon="clock" text={formatWhen(facts.startAt, null, i18n.language)} /> : null}
          {facts.stopCount != null ? <Meta icon="mapPin" text={t('assistant.card.stops', { count: facts.stopCount })} /> : null}
          <PrimaryBtn label={t('assistant.card.openPlan')} onPress={() => onOpen(card.planId, card.roomId)} />
        </>
      ) : (
        <View style={styles.badges}>
          <Badge tone="warning" label={t('assistant.card.unavailable')} />
        </View>
      )}
    </View>
  )
}
