import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { INVITE_CODE } from '@/data/mockData'
import { track } from '@/shared/analytics'
import { useLocaleContent } from '@/shared/i18n'
import type { MessageKey } from '@/shared/i18n/types'
import { Atmosphere, BackHeader, GlassCard, PrimaryBtn } from '@/shared/ui/primitives'
import { colors, spacing } from '@/shared/ui/tokens'
import { styles } from './review.style'

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
  const content = useLocaleContent()
  useLocalSearchParams<{ planId: string }>()
  const [rating, setRating] = useState(0)
  const [tags, setTags] = useState<string[]>([])

  function toggleTag(tag: string) {
    setTags(prev => (prev.includes(tag) ? prev.filter(x => x !== tag) : [...prev, tag]))
  }

  function submit() {
    track('review_submitted', { rating, tags: tags.join(',') })
    router.push(`/room/${INVITE_CODE}/shared-result`)
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
            {[1, 2, 3, 4, 5].map(s => (
              <Pressable key={s} onPress={() => setRating(s)} accessibilityLabel={t('review.starAria', { n: s })}>
                <Text style={[styles.star, s > rating && styles.starDim]}>⭐</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.ratingLabel}>{t(ratingLabelKey(rating))}</Text>
        </GlassCard>

        <GlassCard style={styles.tagsCard}>
          <Text style={styles.tagsTitle}>{t('review.highlights')}</Text>
          <View style={styles.tagRow}>
            {content.reviewTags.map(tag => {
              const active = tags.includes(tag.label)
              return (
                <Pressable
                  key={tag.label}
                  onPress={() => toggleTag(tag.label)}
                  accessibilityState={{ selected: active }}
                  style={[styles.tagBtn, active && styles.tagBtnActive]}
                >
                  <Text style={[styles.tagLabel, active && styles.tagLabelActive]}>
                    {tag.emoji} {tag.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </GlassCard>

        <GlassCard style={styles.inputCard}>
          <TextInput
            placeholder={t('review.placeholder')}
            placeholderTextColor={colors.neutral[300]}
            multiline
            style={styles.input}
          />
        </GlassCard>
      </ScrollView>
      <View style={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[6], paddingTop: spacing[2] }}>
        <PrimaryBtn label={t('review.submit')} onPress={submit} />
      </View>
    </Atmosphere>
  )
}
