import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useCreateReview, usePlan, type Review } from '@/shared/api'
import { track } from '@/shared/analytics'
import type { MessageKey } from '@/shared/i18n/types'
import { haptic } from '@/shared/ui/feedback'
import { Atmosphere, BackHeader, GhostBtn, GlassCard, PrimaryBtn } from '@/shared/ui/primitives'
import { colors, spacing } from '@/shared/ui/tokens'

import { styles } from './review.style'

const MAX_TEXT = 2000
/** Where the counter starts warning rather than just informing. */
const COUNTER_WARN_AT = MAX_TEXT - 100

function ratingLabelKey(rating: number): MessageKey {
  if (rating === 0) return 'review.chooseStars'
  if (rating <= 2) return 'review.rating.bad'
  if (rating <= 3) return 'review.rating.ok'
  if (rating <= 4) return 'review.rating.great'
  return 'review.rating.perfect'
}

export default function ReviewScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { planId } = useLocalSearchParams<{ planId: string }>()

  const plan = usePlan(planId)
  const createReview = useCreateReview()

  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState<Review | null>(null)

  function onContinue() {
    const roomId = plan.data?.roomId
    if (roomId) router.replace(`/room/${roomId}/shared-result`)
    else router.replace('/(tabs)')
  }

  async function submit() {
    // The contract requires 1..5, and the button is disabled below that.
    if (rating === 0) return
    setError(null)

    try {
      const review = await createReview.mutateAsync({
        planId,
        rating,
        ...(text.trim() ? { text: text.trim() } : {}),
      })
      track('review_submitted', { rating, status: review.status })
      haptic('success')
      // The review does not vanish into a navigation — what happens to it next
      // is the answer the user is owed (spec §27).
      setSubmitted(review)
    } catch {
      haptic('error')
      setError(t('review.failed'))
    }
  }

  if (submitted) {
    // A new or edited review starts at `pending` until moderation. Saying so is
    // the difference between "published" and "will be looked at" — and no CMS
    // moderator detail is exposed either way.
    const pending = submitted.status === 'pending'
    return (
      <Atmosphere>
        <View style={styles.successRoot}>
          <Text style={styles.successGlyph}>{pending ? '🕓' : '🎉'}</Text>
          <Text style={styles.successTitle} accessibilityRole="header">
            {t('review.successTitle')}
          </Text>
          <Text style={styles.successBody} accessibilityLiveRegion="polite">
            {t(pending ? 'review.successPending' : 'review.successPublished')}
          </Text>
          <View style={styles.successActions}>
            <PrimaryBtn label={t('review.continue')} onPress={onContinue} />
          </View>
        </View>
      </Atmosphere>
    )
  }

  const nearLimit = text.length >= COUNTER_WARN_AT

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top }}>
        <BackHeader onBack={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: spacing[6] }}>
        <Text style={styles.title}>{t('review.title')}</Text>
        <Text style={styles.body}>{t('review.body')}</Text>

        <GlassCard style={styles.starsCard}>
          <View style={styles.starsRow} accessibilityRole="radiogroup">
            {[1, 2, 3, 4, 5].map(value => (
              <Pressable
                key={value}
                onPress={() => {
                  haptic('select')
                  setRating(value)
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: value === rating }}
                accessibilityLabel={t('review.starAria', { n: value })}
                style={styles.starTap}
              >
                <Text style={[styles.star, value > rating && styles.starDim]}>⭐</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.ratingLabel} accessibilityLiveRegion="polite">
            {t(ratingLabelKey(rating))}
          </Text>
        </GlassCard>

        {/*
          The highlight chips are gone: `POST /reviews` takes only `rating` and
          `text`, with no tags field and no review-tag taxonomy to draw from
          (GoGo-BE#171). Collecting chips that could not be submitted would be
          worse than not offering them.
        */}
        <GlassCard style={styles.inputCard}>
          <TextInput
            value={text}
            onChangeText={value => setText(value.slice(0, MAX_TEXT))}
            placeholder={t('review.placeholder')}
            placeholderTextColor={colors.neutral[500]}
            multiline
            accessibilityLabel={t('review.placeholder')}
            style={styles.input}
          />
        </GlassCard>
        {/* The count only matters as the limit approaches; until then it is
            quiet rather than absent, so the cap is never a surprise. */}
        <View style={styles.counterRow}>
          <Text style={[styles.counter, nearLimit && styles.counterNear]}>
            {text.length} / {MAX_TEXT}
          </Text>
        </View>

        {/* A new review is queued for moderation, never published on the spot. */}
        <Text style={styles.moderationNote}>{t('review.moderationNote')}</Text>

        {error ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
      <View style={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[6], paddingTop: spacing[2] }}>
        {rating === 0 ? <Text style={styles.hint}>{t('review.chooseStars')}</Text> : null}
        <PrimaryBtn
          label={createReview.isPending ? t('review.submitting') : t('review.submit')}
          onPress={submit}
          disabled={rating === 0}
          loading={createReview.isPending}
        />
        <GhostBtn label={t('review.skip')} onPress={onContinue} />
      </View>
    </Atmosphere>
  )
}
