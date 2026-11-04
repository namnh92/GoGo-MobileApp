import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUnistyles } from 'react-native-unistyles'

import { parseApiDate, useMyReviews, useUpdateReview, type Review } from '@/shared/api'
import { useSession } from '@/shared/providers/session-provider'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/async-state.view'
import { Atmosphere, BackHeader, Card, GhostBtn, PrimaryBtn } from '@/shared/ui/primitives'
import { Badge, type BadgeTone } from '@/shared/ui/badge.view'
import { Icon } from '@/shared/ui/icons'
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

export default function MyReviewsScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { theme } = useUnistyles()
  const { status } = useSession()

  const canRead = status === 'user'
  const reviews = useMyReviews({ enabled: canRead })
  const updateReview = useUpdateReview()

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
    <View style={{ paddingTop: insets.top }}>
      <BackHeader onBack={() => router.back()} title={t('myReviews.title')} />
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

  return (
    <Atmosphere>
      {header}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[6] }}
        keyboardShouldPersistTaps="handled"
      >
        {items.length === 0 ? (
          <EmptyState title={t('myReviews.emptyTitle')} body={t('myReviews.emptyBody')} />
        ) : null}

        {items.map(review => {
          const editing = editingId === review.id
          const created = parseApiDate(review.createdAt)
          return (
            <Card padded={false} key={review.id} style={styles.card}>
              <View style={styles.headerRow}>
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
                {/* Moderation state is a fact the author needs: a pending review
                    is not visible to anyone else yet. */}
                <Badge
                  label={t(`myReviews.status.${review.status}`, { defaultValue: review.status })}
                  tone={STATUS_TONE[review.status] ?? 'neutral'}
                />
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
                  {created ? (
                    <Text variant="caption" color="text.secondary">{created.toLocaleDateString(i18n.language)}</Text>
                  ) : null}
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
