import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { detailToPlaceCard, isSaved, openStateFromHours, usePlaceDetail, useSaved, useToggleSaved } from '@/shared/api'
import { useSession } from '@/shared/providers/session-provider'
import { ErrorState } from '@/shared/ui/async-state.view'
import { PlaceCard } from '@/shared/ui/place-card.view'
import { GhostBtn, PrimaryBtn } from '@/shared/ui/primitives'
import { Skeleton } from '@/shared/ui/skeleton.view'
import { Text } from '@/shared/ui/text'
import { usePlaceClock } from '@/shared/ui/use-place-clock'

import { styles } from './import.style'

/** Resolve, submit and moderation may all return a canonical ID. */
export function ExistingPlaceResult({ placeId, onReset }: { placeId: string; onReset: () => void }) {
  const { t } = useTranslation()
  const router = useRouter()
  const { status } = useSession()
  const detail = usePlaceDetail(placeId)
  const now = usePlaceClock()
  const saved = useSaved({ enabled: status === 'user' })
  const toggle = useToggleSaved()
  const marked = isSaved(saved.data, 'place', placeId)
  const canSave = status === 'user'
  return (
    <View style={styles.resultCard}>
      <Text variant="title2">{t('placeImport.existsBody')}</Text>
      {detail.isPending ? <Skeleton height={200} /> : !detail.data ? <ErrorState error={detail.error} onRetry={() => void detail.refetch()} /> : (
        <PlaceCard place={{ ...detailToPlaceCard(detail.data), ...openStateFromHours(detail.data.hours, now) }} onPress={() => router.replace(`/places/${placeId}`)} />
      )}
      <PrimaryBtn label={t('placeImport.openPlace')} onPress={() => router.replace(`/places/${placeId}`)} />
      <GhostBtn label={t(marked ? 'saved.remove' : 'placeDetail.save')} loading={toggle.isPending} disabled={!canSave || !detail.data || saved.isPending || saved.isError} onPress={() => { if (canSave && detail.data && !toggle.isPending) toggle.mutate({ type: 'place', id: placeId, saved: marked }) }} />
      {!canSave ? <Text variant="caption">{t('saved.signInBody')}</Text> : null}
      {toggle.isError ? <Text color="status.dangerText">{t('common.errorBody')}</Text> : null}
      <GhostBtn label={t('placeImport.tryAgain')} onPress={onReset} />
    </View>
  )
}
