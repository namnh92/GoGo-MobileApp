import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { usePlaceDetail } from '@/shared/api'
import { goBackOrHome } from '@/shared/navigation/go-back-or-home'
import { Atmosphere, BackHeader } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'

import { styles } from './place-reviews-page.style'
import { PlaceReviews } from './place-reviews.view'

/**
 * The reviews of one place, on their own page (#452).
 *
 * TODO(#452): the draft's summary (average, total) and a full list need the API:
 * `listPlaceReviews` answers at most three reviews and no totals. Nothing is
 * computed from those three, since a number from a sample would read as the
 * place's score (core rule 14).
 */
export default function PlaceReviewsPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { placeId } = useLocalSearchParams<{ placeId: string }>()
  const place = usePlaceDetail(placeId)

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top }}>
        <BackHeader title={t('placeReviews.pageTitle')} onBack={() => goBackOrHome(router)} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing[6] }]}>
        {place.data?.name ? <Text variant="title1" numberOfLines={2}>{place.data.name}</Text> : null}
        <PlaceReviews placeId={placeId} />
      </ScrollView>
    </Atmosphere>
  )
}
