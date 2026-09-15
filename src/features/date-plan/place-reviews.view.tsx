import { useRouter, type Href } from 'expo-router'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'

import {
  isApiError,
  isHelpfulFallback,
  isMarkedHelpful,
  isOffline,
  parseApiDate,
  useMyReviewReactions,
  usePlaceReviews,
  useToggleReviewHelpful,
  type PublicPlaceReview,
  type ReviewOrder,
} from '@/shared/api'
import { useSession } from '@/shared/providers/session-provider'
import { StaleNotice } from '@/shared/ui/async-state.view'
import { haptic } from '@/shared/ui/feedback'
import { Chip, GhostBtn } from '@/shared/ui/primitives'
import { Skeleton } from '@/shared/ui/skeleton.view'
import { hitSlop } from '@/shared/ui/tokens'

import { styles } from './place-reviews.style'

/** Rows the loading state stands in for; the preview itself holds at most three. */
const SKELETON_ROWS = 2

const ORDERS = [
  { value: 'latest', labelKey: 'placeReviews.orderLatest' },
  { value: 'helpful', labelKey: 'placeReviews.orderHelpful' },
] as const satisfies readonly { value: ReviewOrder; labelKey: string }[]

type MarkFailure = 'own' | 'failed'

/**
 * APP-056 (#212) — the latest published GoGo reviews on Place Detail.
 * APP-060 (#219) — or the most helpful three, with a helpful mark per review.
 *
 * Its own queries and its own states: a slow or failed review read shows here
 * and nowhere else, so the place facts above never wait on it or break with
 * it. Everything in it is GoGo community content. The Google rating keeps its
 * own card and never shares a number with these (core rule 14). The server
 * lists only moderated reviews and owns every count; marks are for signed-in
 * accounts (ADR-0026, proposal), so a guest reads the counts and is asked to
 * sign in rather than shown a control that would fail.
 */
export function PlaceReviews({ placeId }: { placeId: string }) {
  const { t } = useTranslation()
  const router = useRouter()
  const { status } = useSession()
  const canReact = status === 'user'

  const [order, setOrder] = useState<ReviewOrder>('latest')
  const [askSignIn, setAskSignIn] = useState(false)
  const [failure, setFailure] = useState<{ reviewId: string; kind: MarkFailure } | null>(null)

  const reviews = usePlaceReviews(placeId, order)
  const mine = useMyReviewReactions(placeId, { enabled: canReact })
  const toggle = useToggleReviewHelpful(placeId)
  const pendingReviewId = toggle.isPending ? toggle.variables?.reviewId : undefined

  function onHelpful(review: PublicPlaceReview) {
    if (!canReact) {
      setAskSignIn(true)
      return
    }
    // One request per review at a time: a second tap while the first is in
    // flight is dropped here, and the server would not count it twice anyway.
    if (pendingReviewId === review.id) return
    setFailure(null)
    toggle.mutate(
      { reviewId: review.id, helpful: !isMarkedHelpful(mine.data, review.id) },
      {
        // A commit, not a press: the tick confirms the server kept the mark.
        onSuccess: () => haptic('select'),
        onError: error =>
          setFailure({
            reviewId: review.id,
            kind: isApiError(error) && error.code === 'OWN_REVIEW' ? 'own' : 'failed',
          }),
      },
    )
  }

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
        {/* Place Detail carries the offline bar while the device is offline; this
            section adds only its own failed refresh, a timeout while online included. */}
        <StaleNotice
          error={reviews.isError ? reviews.error : null}
          reportOffline={false}
          onRetry={() => void reviews.refetch()}
        />
        {isHelpfulFallback(reviews.data) ? (
          <Text style={styles.fallback}>{t('placeReviews.helpfulFallback')}</Text>
        ) : null}
        <View style={styles.list}>
          {reviews.data.reviews.map(review => (
            <ReviewRow
              key={review.id}
              review={review}
              marked={canReact && isMarkedHelpful(mine.data, review.id)}
              pending={pendingReviewId === review.id}
              failure={failure?.reviewId === review.id ? failure.kind : null}
              onHelpful={() => onHelpful(review)}
            />
          ))}
        </View>
      </>
    )
  }

  // Ordering an empty place changes nothing, so the switch waits for reviews.
  const showOrder = !(order === 'latest' && reviews.data?.reviews.length === 0)

  return (
    <View testID="place-reviews" style={styles.section}>
      <Text accessibilityRole="header" style={styles.title}>
        {t('placeReviews.title')}
      </Text>
      <Text style={styles.source}>{t('placeReviews.source')}</Text>
      {showOrder ? (
        <View style={styles.orderRow}>
          {ORDERS.map(option => (
            <Chip
              key={option.value}
              label={t(option.labelKey)}
              variant={order === option.value ? 'selected' : 'default'}
              onPress={() => setOrder(option.value)}
            />
          ))}
        </View>
      ) : null}
      {body}
      {askSignIn ? (
        <View style={styles.notice} accessibilityLiveRegion="polite">
          <Text style={styles.noticeLabel}>{t('placeReviews.signInToReact')}</Text>
          <GhostBtn
            label={t('auth.signInCta')}
            onPress={() => router.push(`/auth/sign-in?next=place:${placeId}` as Href)}
          />
        </View>
      ) : null}
    </View>
  )
}

function ReviewRow({
  review,
  marked,
  pending,
  failure,
  onHelpful,
}: {
  review: PublicPlaceReview
  marked: boolean
  pending: boolean
  failure: MarkFailure | null
  onHelpful: () => void
}) {
  const { t, i18n } = useTranslation()
  // A deleted account keeps its review but not its name; the label is ours.
  const author = review.author.displayName ?? t('placeReviews.deletedAuthor')
  const written = parseApiDate(review.createdAt)
  const dateLabel = written
    ? t('placeReviews.writtenOn', { date: written.toLocaleDateString(i18n.language) })
    : null
  const spokenRating = t('placeReviews.ratingA11y', { rating: review.rating })

  return (
    <View testID={`place-review-${review.id}`} style={styles.row}>
      <View
        accessible
        accessibilityLabel={[author, spokenRating, dateLabel, review.text].filter(Boolean).join('. ')}
        style={styles.rowContent}
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
      {/* The check glyph and the label repeat what the border colour says. */}
      <Pressable
        onPress={onHelpful}
        disabled={pending}
        accessibilityRole="togglebutton"
        accessibilityLabel={t(marked ? 'placeReviews.unmarkHelpful' : 'placeReviews.markHelpful')}
        accessibilityHint={t('placeReviews.helpfulA11y', { count: review.helpfulCount })}
        accessibilityState={{ checked: marked, disabled: pending, busy: pending }}
        hitSlop={hitSlop}
        style={({ pressed }) => [styles.helpfulBtn, marked && styles.helpfulBtnActive, pressed && styles.helpfulPressed]}
      >
        <Text style={[styles.helpfulLabel, marked && styles.helpfulLabelActive]}>
          {`${marked ? '✓ ' : ''}${t('placeReviews.helpful', { count: review.helpfulCount })}`}
        </Text>
      </Pressable>
      {failure ? (
        <Text accessibilityLiveRegion="polite" style={styles.failure}>
          {t(failure === 'own' ? 'placeReviews.helpfulOwn' : 'placeReviews.helpfulFailed')}
        </Text>
      ) : null}
    </View>
  )
}
