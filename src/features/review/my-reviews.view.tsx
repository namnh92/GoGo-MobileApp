import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { parseApiDate, useMyReviews, useUpdateReview, type Review } from '@/shared/api'
import { useSession } from '@/shared/providers/session-provider'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/async-state.view'
import { Atmosphere, BackHeader, GhostBtn, GlassCard, PrimaryBtn } from '@/shared/ui/primitives'
import { colors, spacing } from '@/shared/ui/tokens'

import { styles } from './my-reviews.style'

const MAX_TEXT = 2000

export default function MyReviewsScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
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
            <GlassCard key={review.id} style={styles.card}>
              <View style={styles.headerRow}>
                <Text style={styles.stars}>{'⭐'.repeat(editing ? draftRating : review.rating)}</Text>
                {/* Moderation state is a fact the author needs: a pending review
                    is not visible to anyone else yet. */}
                <Text style={[styles.status, styles[`status_${review.status}`]]}>
                  {t(`myReviews.status.${review.status}`, { defaultValue: review.status })}
                </Text>
              </View>

              {editing ? (
                <>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map(value => (
                      <Pressable
                        key={value}
                        onPress={() => setDraftRating(value)}
                        accessibilityLabel={t('review.starAria', { n: value })}
                      >
                        <Text style={[styles.starPick, value > draftRating && styles.starDim]}>⭐</Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    value={draftText}
                    onChangeText={value => setDraftText(value.slice(0, MAX_TEXT))}
                    placeholder={t('review.placeholder')}
                    placeholderTextColor={colors.neutral[500]}
                    multiline
                    style={styles.input}
                  />
                  {/* Editing sends it back to pending, so say so before saving. */}
                  <Text style={styles.hint}>{t('myReviews.editResetsModeration')}</Text>
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
                  {review.text ? <Text style={styles.text}>{review.text}</Text> : null}
                  {created ? (
                    <Text style={styles.date}>{created.toLocaleDateString(i18n.language)}</Text>
                  ) : null}
                  <GhostBtn label={t('myReviews.edit')} onPress={() => startEdit(review)} />
                </>
              )}
            </GlassCard>
          )
        })}
      </ScrollView>
    </Atmosphere>
  )
}
