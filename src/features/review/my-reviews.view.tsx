import { AppHeader } from '@/shared/ui/app-header.view'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, View } from 'react-native'
import { TextInput } from '@/shared/ui/text-input'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUnistyles } from 'react-native-unistyles'

import { detailToPlaceCard, parseApiDate, useMyReviews, usePlaceDetail, usePlan, useUpdateReview, type Review } from '@/shared/api'
import { useSession } from '@/shared/providers/session-provider'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/async-state.view'
import { Atmosphere, Card, Chip, GhostBtn, PrimaryBtn } from '@/shared/ui/primitives'
import { Badge, type BadgeTone } from '@/shared/ui/badge.view'
import { Icon } from '@/shared/ui/icons'
import { FormattedPlaceAddress } from '@/shared/ui/place-address.view'
import { PlaceCardSmall } from '@/shared/ui/place-card-small.view'
import { Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'

import { styles } from './my-reviews.style'

const MAX_TEXT = 2000

/** Moderation state as a badge tone; an unknown state reads as neutral. */
const STATUS_TONE: Record<string, BadgeTone> = {
  pending: 'warning',
  published: 'success',
  rejected: 'danger',
  removed: 'neutral',
}

const FILTER_STATUSES = ['published', 'pending', 'rejected', 'removed'] as const
type StatusFilter = 'all' | (typeof FILTER_STATUSES)[number]

/** What the review is about, read from the place or plan it points at. A failed read never breaks the card. */
function ReviewSubject({ review, onOpenPlace }: { review: Review; onOpenPlace: (placeId: string) => void }) {
  return review.placeId ? (
    <PlaceSubject placeId={review.placeId} onOpenPlace={onOpenPlace} />
  ) : (
    <WholeDateSubject planId={review.planId} />
  )
}

function PlaceSubject({ placeId, onOpenPlace }: { placeId: string; onOpenPlace: (placeId: string) => void }) {
  const { t } = useTranslation()
  const place = usePlaceDetail(placeId)

  const name = place.data?.name || t('myReviews.placeFallback')
  return (
    <FormattedPlaceAddress place={place.data}>{address => <View testID="my-review-subject">
      <PlaceCardSmall
        place={detailToPlaceCard({ ...place.data, id: placeId, name })}
        onPress={() => onOpenPlace(placeId)}
        accessibilityLabel={address ? `${name}, ${address}` : name}
        accessibilityHint={t('myReviews.openPlace')}
        bodyTrailing={place.isPending ? (
          <Text variant="caption" color="text.secondary">{t('common.loading')}</Text>
        ) : place.isError ? (
          <Text variant="caption" color="status.dangerText">{t('myReviews.placeLoadFailed')}</Text>
        ) : null}
      />
    </View>}</FormattedPlaceAddress>
  )
}

function WholeDateSubject({ planId }: { planId: string | undefined }) {
  const { t, i18n } = useTranslation()
  const plan = usePlan(planId)
  const created = parseApiDate(plan.data?.createdAt)

  return (
    <View style={styles.subject} testID="my-review-subject">
      <Text variant="title2" numberOfLines={1}>{t('review.subjectOverall')}</Text>
      {created ? (
        <Text variant="caption" color="text.secondary">
          {t('myReviews.planCreated', { date: created.toLocaleDateString(i18n.language) })}
        </Text>
      ) : null}
    </View>
  )
}

export default function MyReviewsScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { theme } = useUnistyles()
  const { status } = useSession()

  const canRead = status === 'user'
  const reviews = useMyReviews({ enabled: canRead })
  const updateReview = useUpdateReview()

  const [filter, setFilter] = useState<StatusFilter>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftRating, setDraftRating] = useState(5)
  const [draftText, setDraftText] = useState('')

  function startEdit(review: Review) {
    setEditingId(review.id)
    setDraftRating(review.rating)
    setDraftText(review.text ?? '')
  }

  async function save(review: Review) {
    try {
      await updateReview.mutateAsync({
        id: review.id,
        rating: draftRating,
        ...(draftText.trim() ? { text: draftText.trim() } : {}),
      })
      setEditingId(null)
    } catch {
      // The row keeps its edit state so the text is not lost.
    }
  }

  const header = (
    <View>
      <AppHeader showNotifications={false} onBack={() => router.back()} title={t('myReviews.title')} />
    </View>
  )

  if (!canRead) {
    return (
      <Atmosphere>
        {header}
        <EmptyState
          title={t('notifications.signInTitle')}
          body={t('myReviews.signInBody')}
          action={<GhostBtn label={t('auth.signInCta')} onPress={() => router.push('/auth/sign-in')} />}
        />
      </Atmosphere>
    )
  }

  if (reviews.isPending) {
    return (
      <Atmosphere>
        {header}
        <LoadingState />
      </Atmosphere>
    )
  }

  if (reviews.isError) {
    return (
      <Atmosphere>
        {header}
        <ErrorState error={reviews.error} onRetry={() => void reviews.refetch()} />
      </Atmosphere>
    )
  }

  const items = reviews.data ?? []
  const countOf = (status: string) => items.filter(review => review.status === status).length
  const visible = filter === 'all' ? items : items.filter(review => review.status === filter)
  const filterOptions = FILTER_STATUSES.filter(status => status !== 'removed' || countOf(status) > 0)

  return (
    <Atmosphere>
      {header}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[6] }}
        keyboardShouldPersistTaps="handled"
      >
        {items.length === 0 ? (
          <EmptyState title={t('myReviews.emptyTitle')} body={t('myReviews.emptyBody')} />
        ) : (
          <>
            {/* Filters the list already loaded: no new request, counts are of that list. */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
              accessibilityLabel={t('myReviews.filterAria')}
            >
              <Chip
                label={t('myReviews.filterChip', { label: t('myReviews.filter.all'), count: items.length })}
                variant={filter === 'all' ? 'selected' : 'default'}
                onPress={() => setFilter('all')}
              />
              {filterOptions.map(status => (
                <Chip
                  key={status}
                  label={t('myReviews.filterChip', { label: t(`myReviews.status.${status}`), count: countOf(status) })}
                  variant={filter === status ? 'selected' : 'default'}
                  onPress={() => setFilter(status)}
                />
              ))}
            </ScrollView>
            <View style={styles.note}>
              <Icon name="info" size={18} color="status.infoText" />
              <Text variant="caption" color="status.infoText" style={styles.noteText}>
                {t('myReviews.editResetsModeration')}
              </Text>
            </View>
          </>
        )}

        {items.length > 0 && visible.length === 0 ? (
          <EmptyState title={t('myReviews.filterEmptyTitle')} body={t('myReviews.filterEmptyBody')} />
        ) : null}

        {visible.map(review => {
          const editing = editingId === review.id
          const created = parseApiDate(review.createdAt)
          return (
            <Card padded={false} key={review.id} style={styles.card}>
              {/* Subject first, so the card says what was reviewed; then its moderation state. */}
              <View style={styles.subjectRow}>
                <ReviewSubject review={review} onOpenPlace={id => router.push(`/places/${id}`)} />
                {/* A pending review is not visible to anyone else yet; the state is a word, never colour alone. */}
                <Badge
                  label={t(`myReviews.status.${review.status}`, { defaultValue: review.status })}
                  tone={STATUS_TONE[review.status] ?? 'neutral'}
                />
              </View>

              <View style={styles.headerRow}>
                <View style={styles.ratingGroup}>
                  <View
                    style={styles.stars}
                    accessible
                    accessibilityLabel={t('review.starAria', { count: editing ? draftRating : review.rating })}
                  >
                    {[1, 2, 3, 4, 5].map(value => (
                      <Icon
                        key={value}
                        name="star"
                        size={18}
                        color="accent.primary"
                        filled={value <= (editing ? draftRating : review.rating)}
                      />
                    ))}
                  </View>
                  <Text variant="label">{t('myReviews.yourRating', { count: editing ? draftRating : review.rating })}</Text>
                </View>
                {created ? (
                  <Text variant="caption" color="text.secondary">{created.toLocaleDateString(i18n.language)}</Text>
                ) : null}
              </View>

              {editing ? (
                <>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map(value => (
                      <Pressable
                        key={value}
                        onPress={() => setDraftRating(value)}
                        accessibilityLabel={t('review.starAria', { count: value })}
                        style={styles.starTap}
                      >
                        <Icon name="star" size={24} color="accent.primary" filled={value <= draftRating} />
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    value={draftText}
                    onChangeText={value => setDraftText(value.slice(0, MAX_TEXT))}
                    placeholder={t('review.placeholder')}
                    placeholderTextColor={theme.text.secondary}
                    multiline
                    style={styles.input}
                  />
                  {/* Editing sends it back to pending, so say so before saving. */}
                  <Text variant="caption" color="text.secondary">{t('myReviews.editResetsModeration')}</Text>
                  <View style={styles.actions}>
                    <GhostBtn label={t('account.deleteCancel')} onPress={() => setEditingId(null)} />
                    <PrimaryBtn
                      label={updateReview.isPending ? t('account.saving') : t('account.save')}
                      onPress={() => save(review)}
                      loading={updateReview.isPending}
                      style={{ flex: 1 }}
                    />
                  </View>
                </>
              ) : (
                <>
                  {review.text ? <Text variant="body">{review.text}</Text> : null}
                  {/* TODO(https://github.com/namnh92/GoGo-BE/issues/752): helpful count, rejection reason and review photos once the API returns them. */}
                  <GhostBtn label={t('myReviews.edit')} onPress={() => startEdit(review)} style={styles.editBtn} />
                </>
              )}
            </Card>
          )
        })}
      </ScrollView>
    </Atmosphere>
  )
}
