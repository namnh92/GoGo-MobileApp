import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'

import { isOffline, parseApiDate, usePlaceReviews, type PublicPlaceReview } from '@/shared/api'
import { StaleNotice } from '@/shared/ui/async-state.view'
import { GhostBtn } from '@/shared/ui/primitives'
import { Skeleton } from '@/shared/ui/skeleton.view'

import { styles } from './place-reviews.style'

/** Rows the loading state stands in for; the preview itself holds at most three. */
const SKELETON_ROWS = 2

/**
 * APP-056 (#212) — the latest published GoGo reviews on Place Detail.
 *
 * Its own query and its own states: a slow or failed review read shows here and
 * nowhere else, so the place facts above never wait on it or break with it.
 * Everything in it is GoGo community content. The Google rating keeps its own
 * card and never shares a number with these (core rule 14). The server lists
 * only moderated reviews, so nothing here filters or invents any.
 */
export function PlaceReviews({ placeId }: { placeId: string }) {
  const { t } = useTranslation()
  const reviews = usePlaceReviews(placeId)

  let body: ReactNode
  if (reviews.isPending) {
    body = (
      <View accessibilityRole="progressbar" accessibilityLabel={t('placeReviews.loading')} style={styles.list}>
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <View key={index} style={styles.row}>
            <Skeleton width="40%" height={14} />
            <Skeleton width="90%" />
            <Skeleton width="70%" />
          </View>
        ))}
      </View>
    )
  } else if (!reviews.data) {
    body = (
      <View style={styles.notice} accessibilityLiveRegion="polite">
        <Text style={styles.noticeLabel}>
          {t(isOffline(reviews.error) ? 'placeReviews.offline' : 'placeReviews.error')}
        </Text>
        <GhostBtn label={t('common.retry')} onPress={() => void reviews.refetch()} />
      </View>
    )
  } else if (reviews.data.reviews.length === 0) {
    body = <Text style={styles.empty}>{t('placeReviews.empty')}</Text>
  } else {
    body = (
      <>
        <StaleNotice error={reviews.isError ? reviews.error : null} onRetry={() => void reviews.refetch()} />
        <View style={styles.list}>
          {reviews.data.reviews.map(review => (
            <ReviewRow key={review.id} review={review} />
          ))}
        </View>
      </>
    )
  }

  return (
    <View testID="place-reviews" style={styles.section}>
      <Text accessibilityRole="header" style={styles.title}>
        {t('placeReviews.title')}
      </Text>
      <Text style={styles.source}>{t('placeReviews.source')}</Text>
      {body}
    </View>
  )
}

function ReviewRow({ review }: { review: PublicPlaceReview }) {
  const { t, i18n } = useTranslation()
  // A deleted account keeps its review but not its name; the label is ours.
  const author = review.author.displayName ?? t('placeReviews.deletedAuthor')
  const written = parseApiDate(review.createdAt)
  const dateLabel = written
    ? t('placeReviews.writtenOn', { date: written.toLocaleDateString(i18n.language) })
    : null
  const spokenRating = t('placeReviews.ratingA11y', { rating: review.rating })

  return (
    <View
      testID={`place-review-${review.id}`}
      accessible
      accessibilityLabel={[author, spokenRating, dateLabel, review.text].filter(Boolean).join('. ')}
      style={styles.row}
    >
      <View style={styles.rowHeader}>
        <Text style={styles.author} numberOfLines={1}>
          {author}
        </Text>
        <Text style={styles.rating}>{t('placeReviews.rating', { rating: review.rating })}</Text>
      </View>
      {dateLabel ? <Text style={styles.date}>{dateLabel}</Text> : null}
      {review.text ? <Text style={styles.text}>{review.text}</Text> : null}
    </View>
  )
}
