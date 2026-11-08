import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import type { AssistantPlaceCard, AssistantPlanCard, AssistantResultCard } from '@/shared/api'
import { detailToPlaceCard } from '@/shared/api'
import { Badge } from '@/shared/ui/badge.view'
import { SecondaryBtn } from '@/shared/ui/button.view'
import { Icon, type IconName } from '@/shared/ui/icons'
import { PlaceCard } from '@/shared/ui/place-card.view'
import { Text } from '@/shared/ui/text'

import { formatWhen } from './format'
import { styles } from './result-card.style'

/**
 * Design system `ResultCard` (GoGo-MobileApp#378): a place or a plan the
 * assistant found. Every fact on it is what the server read from verified
 * GoGo data (contract `AssistantPlaceCard.facts`), never model text; a place
 * that is no longer usable says so and offers nothing to do. One
 * secondary action, the likely next step: a thread can hold several cards,
 * and the screen keeps one filled primary button.
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
  const place = detailToPlaceCard({ id: card.placeId, name: facts.name, addressText: facts.addressText,
    gogoRating: card.available ? facts.gogoRating : undefined,
    gogoRatingCount: card.available ? facts.gogoRatingCount : undefined,

  })
  return <View testID={`assistant-card-${card.placeId}`}>
    <PlaceCard place={{ ...place, openNow: card.available ? facts.openNow ?? undefined : undefined,
      priceMin: card.available ? facts.priceMin ?? null : null, priceMax: card.available ? facts.priceMax ?? null : null,
      currency: facts.currency ?? 'VND', priceUnit: 'per_person', priceUncertain: false }}
      variant="compact" unavailableLabel={card.available ? undefined : t('assistant.card.unavailable')}
      footer={card.available ? <SecondaryBtn label={t('assistant.card.viewPlace')} onPress={() => onOpen(card.placeId)} icon="eye" /> : undefined} />
  </View>
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
          <SecondaryBtn label={t('assistant.card.openPlan')} onPress={() => onOpen(card.planId, card.roomId)} />
        </>
      ) : (
        <View style={styles.badges}>
          <Badge tone="warning" label={t('assistant.card.unavailable')} />
        </View>
      )}
    </View>
  )
}
