import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import type { PlanStopRow } from '@/shared/api'
import { PrimaryBtn } from '@/shared/ui/primitives'
import { colors, spacing } from '@/shared/ui/tokens'

import { CHECKIN_TAGS } from './checkin-tags'
import { styles } from './checkin-sheet.style'

const MAX_TAGS = 10
const MAX_NOTE = 1000

export interface CheckinDraft {
  rating: number
  /** Stable keys, not localised labels — see `checkin-tags.ts`. */
  tags: string[]
  note: string
}

interface CheckinSheetProps {
  visible: boolean
  stop: PlanStopRow
  placeName: string
  pending?: boolean
  onSave: (checkin: CheckinDraft) => void
  onSkip: () => void
}

export function CheckinSheet({ visible, stop, placeName, pending, onSave, onSkip }: CheckinSheetProps) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  // Prefill the happy path — the user can change everything.
  const [rating, setRating] = useState(5)
  const [tags, setTags] = useState<string[]>([CHECKIN_TAGS[0].key])
  const [note, setNote] = useState('')

  function reset() {
    setRating(5)
    setTags([CHECKIN_TAGS[0].key])
    setNote('')
  }

  function toggleTag(key: string) {
    setTags(prev => {
      if (prev.includes(key)) return prev.filter(x => x !== key)
      return prev.length < MAX_TAGS ? [...prev, key] : prev
    })
  }

  function save() {
    onSave({ rating, tags, note: note.trim() })
    reset()
  }

  function skip() {
    onSkip()
    reset()
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={skip}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={skip} />
        <View style={[styles.sheet, { maxHeight: '85%' }]}>
          <View style={styles.handle} />
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + spacing[5] }}
          >
            <View style={styles.headerRow}>
              <Text style={styles.headerEmoji}>📍</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{t('checkin.title')}</Text>
                <Text style={styles.stopName} numberOfLines={1}>
                  {placeName}
                </Text>
              </View>
            </View>

            <Text style={styles.rateLabel}>{t('checkin.rate')}</Text>
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

            <View style={styles.tagRow}>
              {CHECKIN_TAGS.map(tag => {
                const active = tags.includes(tag.key)
                return (
                  <Pressable
                    key={tag.key}
                    onPress={() => toggleTag(tag.key)}
                    accessibilityState={{ selected: active }}
                    style={[styles.tagBtn, active && styles.tagBtnActive]}
                  >
                    <Text style={[styles.tagLabel, active && styles.tagLabelActive]}>
                      {tag.emoji} {t(`checkin.tag.${tag.key}`)}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            <TextInput
              value={note}
              onChangeText={value => setNote(value.slice(0, MAX_NOTE))}
              placeholder={t('checkin.notePlaceholder')}
              placeholderTextColor={colors.neutral[300]}
              multiline
              style={styles.input}
            />

            {/*
              Photos and the verified bill (FR-PLAN-008) are missing on purpose.
              The API takes `photoKeys` and `billPhotoKey` — keys of already
              uploaded objects — and the contract exposes no upload endpoint for
              a client (GoGo-BE#171). `billTotal` is rejected without
              `billPhotoKey`, so a bill form here could never be submitted.
            */}
            <Text style={styles.unavailableNote}>{t('checkin.photosUnavailable')}</Text>

            <PrimaryBtn
              label={pending ? t('checkin.saving') : t('checkin.save')}
              onPress={save}
              loading={pending}
              style={styles.saveBtn}
            />
            <Pressable onPress={skip} style={styles.skipBtn}>
              <Text style={styles.skipLabel}>{t('checkin.skip')}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
