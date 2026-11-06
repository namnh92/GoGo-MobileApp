import { useRouter, type Href } from 'expo-router'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, View, type LayoutChangeEvent } from 'react-native'

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
import { Icon } from '@/shared/ui/icons'
import { AvatarCircle, Chip, GhostBtn } from '@/shared/ui/primitives'
import { Skeleton } from '@/shared/ui/skeleton.view'
import { Text } from '@/shared/ui/text'
import { hitSlop } from '@/shared/ui/tokens'
import type { MessageKey } from '@/shared/i18n/types'

import { styles } from './place-reviews.style'

/** Two rows preserve the list layout while its first page loads. */
const SKELETON_ROWS = 2

const ORDERS = [
  { value: 'latest', labelKey: 'placeReviews.orderLatest' },
  { value: 'helpful', labelKey: 'placeReviews.orderHelpful' },
] as const satisfies readonly { value: ReviewOrder; labelKey: MessageKey }[]

type MarkFailure = 'own' | 'failed'

/**
 * APP-056 (#212) — the latest published GoGo reviews on Place Detail.
 * APP-060 (#219), #482 — latest/helpful pages, with a helpful mark per review.
 *
 * Its own queries and its own states: a slow or failed review read shows here
 * and nowhere else, so the place facts above never wait on it or break with
 * it. Everything in it is GoGo community content. The Google rating keeps its
 * own card and never shares a number with these (core rule 14). The server
 * lists only moderated reviews and owns every count; marks are for signed-in
 * accounts (ADR-0026, proposal), so a guest reads the counts and is asked to
 * sign in rather than shown a control that would fail.
 */
export function PlaceReviews({ placeId, onLayout }: { placeId: string; onLayout?: (event: LayoutChangeEvent) => void }) {
  const { t } = useTranslation()
  const router = useRouter()
  const { status } = useSession()
  const canReact = status === 'user'

  const [order, setOrder] = useState<ReviewOrder>('latest')
  const [askSignIn, setAskSignIn] = useState(false)
  const [failure, setFailure] = useState<{ reviewId: string; kind: MarkFailure } | null>(null)

  const reviews = usePlaceReviews(placeId, order)
  const firstPage = reviews.data?.pages[0]
  const rows = [...new Map(reviews.data?.pages.flatMap(page => page.items ?? page.reviews).map(review => [review.id, review])).values()]
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
        <Text variant="bodySmall" color="text.secondary">
          {t(isOffline(reviews.error) ? 'placeReviews.offline' : 'placeReviews.error')}
        </Text>
        <GhostBtn label={t('common.retry')} onPress={() => void reviews.refetch()} />
      </View>
    )
  } else if (rows.length === 0) {
    body = <Text variant="bodySmall" color="text.secondary" style={styles.empty}>{t('placeReviews.empty')}</Text>
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
        {isHelpfulFallback(firstPage) ? (
          <Text variant="caption" color="text.secondary" style={styles.fallback}>{t('placeReviews.helpfulFallback')}</Text>
        ) : null}
        <View style={styles.list}>
          {rows.map(review => (
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
  const showOrder = !(order === 'latest' && rows.length === 0)

  return (
    <View testID="place-reviews" style={styles.section} onLayout={onLayout}>
      <Text variant="title2" accessibilityRole="header">
        {t('placeReviews.title')}{firstPage?.gogoRatingCount != null ? ` (${firstPage.gogoRatingCount})` : ''}
      </Text>
      {/* The source line is a banner: GoGo's reviews are never merged with Google's. */}
      <View style={styles.sourceBanner}>
        <Icon name="checkCircle" size={20} color="status.successText" />
        <Text variant="bodySmall" color="status.successText" style={styles.source}>{t('placeReviews.source')}</Text>
      </View>
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
      {reviews.hasNextPage ? (
        <GhostBtn
          label={t(reviews.isFetchNextPageError ? 'common.retry' : 'placeReviews.loadMore')}
          loading={reviews.isFetchingNextPage}
          onPress={() => { if (!reviews.isFetchingNextPage) void reviews.fetchNextPage() }}
        />
      ) : null}
      {askSignIn ? (
        <View style={styles.notice} accessibilityLiveRegion="polite">
          <Text variant="bodySmall" color="text.secondary">{t('placeReviews.signInToReact')}</Text>
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
          <AvatarCircle label={Array.from(author)[0]?.toUpperCase()} size={40} />
          <View style={styles.authorBlock}>
            <Text variant="title2" style={styles.author} numberOfLines={1}>
              {author}
            </Text>
            {dateLabel ? <Text variant="caption" color="text.secondary">{dateLabel}</Text> : null}
          </View>
          <View style={styles.ratingPill}>
            <Text variant="label" color="accent.primary">{t('placeReviews.rating', { rating: review.rating })}</Text>
          </View>
        </View>
        {review.verifiedVisit ? <Text variant="caption" color="status.successText">{t('placeReviews.verifiedVisit')}</Text> : null}
        {review.text ? <Text style={styles.reviewText}>{review.text}</Text> : null}
      </View>
      <View style={styles.divider} />
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
        <Text variant="label" color={marked ? 'text.primary' : 'text.primary'}>
          {`${marked ? '✓ ' : ''}${t('placeReviews.helpful', { count: review.helpfulCount })}`}
        </Text>
      </Pressable>
      {failure ? (
        <Text variant="caption" accessibilityLiveRegion="polite">
          {t(failure === 'own' ? 'placeReviews.helpfulOwn' : 'placeReviews.helpfulFailed')}
        </Text>
      ) : null}
    </View>
  )
}
