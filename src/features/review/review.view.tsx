import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useCreateReview, usePlan } from '@/shared/api'
import { track } from '@/shared/analytics'
import type { MessageKey } from '@/shared/i18n/types'
import { Atmosphere, BackHeader, GlassCard, PrimaryBtn } from '@/shared/ui/primitives'
import { colors, spacing } from '@/shared/ui/tokens'

import { styles } from './review.style'

const MAX_TEXT = 2000

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

  async function submit() {
    // The contract requires 1..5; submitting 0 would be rejected server-side.
    if (rating === 0) {
      setError(t('review.chooseStars'))
      return
    }
    setError(null)

    try {
      const review = await createReview.mutateAsync({
        planId,
        rating,
        ...(text.trim() ? { text: text.trim() } : {}),
      })
      track('review_submitted', { rating, status: review.status })

      const roomId = plan.data?.roomId
      if (roomId) router.replace(`/room/${roomId}/shared-result`)
      else router.replace('/(tabs)')
    } catch {
      setError(t('review.failed'))
    }
  }

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top }}>
        <BackHeader onBack={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: spacing[6] }}>
        <Text style={styles.title}>{t('review.title')}</Text>
        <Text style={styles.body}>{t('review.body')}</Text>

        <GlassCard style={styles.starsCard}>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map(value => (
              <Pressable
                key={value}
                onPress={() => setRating(value)}
                accessibilityLabel={t('review.starAria', { n: value })}
              >
                <Text style={[styles.star, value > rating && styles.starDim]}>⭐</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.ratingLabel}>{t(ratingLabelKey(rating))}</Text>
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
            placeholderTextColor={colors.neutral[300]}
            multiline
            accessibilityLabel={t('review.placeholder')}
            style={styles.input}
          />
        </GlassCard>

        {/* A new review is queued for moderation, never published on the spot. */}
        <Text style={styles.moderationNote}>{t('review.moderationNote')}</Text>

        {error ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
      <View style={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[6], paddingTop: spacing[2] }}>
        <PrimaryBtn
          label={createReview.isPending ? t('review.submitting') : t('review.submit')}
          onPress={submit}
          loading={createReview.isPending}
        />
      </View>
    </Atmosphere>
  )
}
