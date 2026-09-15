import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useUploadImage, type PlanStopRow } from '@/shared/api'
import { PrimaryBtn } from '@/shared/ui/primitives'
import { colors, spacing } from '@/shared/ui/tokens'

import { CHECKIN_TAGS } from './checkin-tags'
import { styles } from './checkin-sheet.style'

const MAX_TAGS = 10
const MAX_NOTE = 1000
const MAX_PHOTOS = 3

export interface CheckinDraft {
  rating: number
  /** Stable keys, not localised labels — see `checkin-tags.ts`. */
  tags: string[]
  note: string
  /** Storage keys from `POST /uploads`; the check-in never carries bytes. */
  photoKeys: string[]
}

/** A picked photo and where it is in the presign → PUT round trip. */
interface PendingPhoto {
  uri: string
  key: string | null
  failed: boolean
}

interface CheckinSheetProps {
  visible: boolean
  stop: PlanStopRow
  placeName: string
  pending?: boolean
  /** Why the last save did not land. The draft stays, so Save retries it. */
  error?: string | null
  /** Resolves true once the check-in is saved. */
  onSave: (checkin: CheckinDraft) => Promise<boolean>
  onSkip: () => void
}

export function CheckinSheet({ visible, stop, placeName, pending, error, onSave, onSkip }: CheckinSheetProps) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  // Prefill the happy path — the user can change everything.
  const [rating, setRating] = useState(5)
  const [tags, setTags] = useState<string[]>([CHECKIN_TAGS[0].key])
  const [note, setNote] = useState('')
  const [photos, setPhotos] = useState<PendingPhoto[]>([])
  const upload = useUploadImage()

  function reset() {
    setRating(5)
    setTags([CHECKIN_TAGS[0].key])
    setNote('')
    setPhotos([])
  }

  /**
   * Uploads as soon as a photo is picked, so saving never waits on the network
   * twice. A failed upload marks that photo and nothing else — a check-in
   * without its picture is still a check-in.
   */
  async function addPhoto() {
    if (photos.length >= MAX_PHOTOS) return
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) return

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    })
    const asset = picked.canceled ? null : picked.assets[0]
    if (!asset) return

    const index = photos.length
    setPhotos(prev => [...prev, { uri: asset.uri, key: null, failed: false }])
    try {
      const key = await upload.mutateAsync({
        image: { uri: asset.uri, mimeType: asset.mimeType },
        purpose: 'checkin_photo',
      })
      setPhotos(prev => prev.map((p, i) => (i === index ? { ...p, key } : p)))
    } catch {
      setPhotos(prev => prev.map((p, i) => (i === index ? { ...p, failed: true } : p)))
    }
  }

  function removePhoto(index: number) {
    setPhotos(prev => prev.filter((_, i) => i !== index))
  }

  function toggleTag(key: string) {
    setTags(prev => {
      if (prev.includes(key)) return prev.filter(x => x !== key)
      return prev.length < MAX_TAGS ? [...prev, key] : prev
    })
  }

  async function save() {
    // Only photos that actually landed carry a key; the rest are dropped rather
    // than sent as a reference the server would reject.
    const photoKeys = photos.map(p => p.key).filter((k): k is string => Boolean(k))
    // A save that did not land keeps the draft, so the retry sends what the user chose (#278).
    if (await onSave({ rating, tags, note: note.trim(), photoKeys })) reset()
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
                    accessibilityRole="button"
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
              placeholderTextColor={colors.neutral[500]}
              multiline
              style={styles.input}
            />

            {/*
              Photos upload the moment they are picked and travel as storage
              keys. The verified bill (FR-PLAN-008) is still absent: `billTotal`
              is rejected without `billPhotoKey`, and that flow needs its own
              amount/people form rather than riding on the photo picker.
            */}
            <View style={styles.photoRow}>
              {photos.map((photo, index) => (
                <Pressable
                  key={photo.uri}
                  onPress={() => removePhoto(index)}
                  accessibilityRole="button"
                  accessibilityLabel={t('checkin.removePhoto')}
                >
                  <Image source={{ uri: photo.uri }} style={styles.photoThumb} contentFit="cover" />
                  {photo.key === null && !photo.failed ? (
                    <View style={styles.photoOverlay}>
                      <ActivityIndicator color={colors.neutral[0]} />
                    </View>
                  ) : null}
                  {photo.failed ? (
                    <View style={styles.photoOverlay}>
                      <Text style={styles.photoFailed}>!</Text>
                    </View>
                  ) : null}
                </Pressable>
              ))}
              {photos.length < MAX_PHOTOS ? (
                <Pressable
                  onPress={addPhoto}
                  accessibilityRole="button"
                  accessibilityLabel={t('checkin.addPhoto')}
                  style={styles.photoAdd}
                >
                  <Text style={styles.photoAddGlyph}>+</Text>
                </Pressable>
              ) : null}
              <Text style={styles.photoCount}>{t('checkin.photoCount', { n: photos.length })}</Text>
            </View>
            {photos.some(p => p.failed) ? (
              <Text accessibilityLiveRegion="polite" style={styles.unavailableNote}>
                {t('checkin.photoFailed')}
              </Text>
            ) : null}

            {error ? (
              <Text accessibilityLiveRegion="polite" style={styles.saveFailed}>
                {error}
              </Text>
            ) : null}
            <PrimaryBtn
              label={pending ? t('checkin.saving') : t('checkin.save')}
              onPress={save}
              loading={pending}
              style={styles.saveBtn}
            />
            <Pressable
              accessibilityRole="button"
              onPress={skip}
              style={styles.skipBtn}
            >
              <Text style={styles.skipLabel}>{t('checkin.skip')}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
