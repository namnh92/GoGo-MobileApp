import { BlockingLoadingOverlay } from '@/shared/ui/blocking-loading-overlay.view'
import { loadingIndicator } from '@/shared/ui/tokens'
import { LoadingIndicator } from '@/shared/ui/loading-indicator.view'
import { SheetActions } from '@/shared/ui/sheet-actions.view'
import { SecondaryBtn } from '@/shared/ui/button.view'
import { Chip } from '@/shared/ui/chip.view'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, View, ScrollView } from 'react-native'
import { TextInput } from '@/shared/ui/text-input'
import { useUnistyles } from 'react-native-unistyles'

import { useUploadImage, type PlanStopRow } from '@/shared/api'
import { Icon } from '@/shared/ui/icons'
import { PrimaryBtn } from '@/shared/ui/primitives'
import { Sheet } from '@/shared/ui/sheet.view'
import { Glyph, Text } from '@/shared/ui/text'

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
  const { theme } = useUnistyles()
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
    // A save in flight decides where the date goes next; closing now as well
    // would move it on twice (#278).
    if (pending) return
    onSkip()
    reset()
  }

  return (
    <Sheet visible={visible} onClose={skip} scroll={false}>
      <BlockingLoadingOverlay visible={Boolean(pending)} />
      <ScrollView style={styles.scroll} bounces={false} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <Icon name="mapPin" size={28} color="accent.primary" />
        <View style={{ flex: 1 }}>
          <Text variant="title1">{t('checkin.title')}</Text>
          <Text variant="bodySmall" color="text.secondary" style={styles.stopName} numberOfLines={1}>
            {placeName}
          </Text>
        </View>
      </View>

      <View style={styles.rateCard}>
        <Text variant="title2">{t('checkin.rate')}</Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map(value => (
            <Pressable
              key={value}
              onPress={() => setRating(value)}
              accessibilityRole="button"
              accessibilityLabel={t('review.starAria', { count: value })}
              accessibilityState={{ selected: value <= rating }}
              style={styles.star}
            >
              {/* Filled up to the rating, outlined past it — shape, not a fade (#382). */}
              <Icon
                testID={value <= rating ? `checkin-star-${value}-filled` : `checkin-star-${value}`}
                name="star"
                size={36}
                filled={value <= rating}
                color={value <= rating ? 'accent.primary' : 'text.secondary'}
              />
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.tagRow}>
          {CHECKIN_TAGS.map(tag => {
            const active = tags.includes(tag.key)
            return (
              <Chip key={tag.key} label={t(`checkin.tag.${tag.key}`)} emoji={tag.emoji}
                variant={active ? 'selected' : 'default'} onPress={() => toggleTag(tag.key)} />
            )
          })}
        </View>
      </View>

      {/*
        Photos upload the moment they are picked and travel as storage
        keys. The verified bill (FR-PLAN-008) is still absent: `billTotal`
        is rejected without `billPhotoKey`, and that flow needs its own
        amount/people form rather than riding on the photo picker.
      */}
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text variant="title2">{t('checkin.addPhoto')}</Text>
          <Text variant="caption" color="text.secondary">{t('checkin.photoCount', { n: photos.length })}</Text>
        </View>
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
                  <LoadingIndicator size={loadingIndicator.compactSize} />
                </View>
              ) : null}
              {photo.failed ? (
                <View style={styles.photoOverlay}>
                  <Text variant="title1" color="text.inverse">!</Text>
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
              <Glyph size="sm" color="text.secondary">+</Glyph>
            </Pressable>
          ) : null}
        </View>
        {photos.some(p => p.failed) ? (
          <Text variant="caption" color="text.secondary" accessibilityLiveRegion="polite" style={styles.unavailableNote}>
            {t('checkin.photoFailed')}
          </Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text variant="title2">{t('checkin.noteLabel')}</Text>
        <TextInput
          value={note}
          onChangeText={value => setNote(value.slice(0, MAX_NOTE))}
          accessibilityLabel={t('checkin.noteLabel')}
          placeholder={t('checkin.notePlaceholder')}
          placeholderTextColor={theme.text.secondary}
          multiline
          style={styles.input}
        />
      </View>

      {error ? (
        <Text variant="bodySmall" color="status.dangerText" accessibilityLiveRegion="polite" style={styles.saveFailed}>
          {error}
        </Text>
      ) : null}
      </ScrollView>
      {/* Outside the scroll, so both ways out are on screen as the sheet opens. */}
      <SheetActions>
        <SecondaryBtn label={t('checkin.skip')} onPress={skip} disabled={Boolean(pending)} />
        <PrimaryBtn label={pending ? t('checkin.saving') : t('checkin.save')} onPress={save} loading={pending} />
      </SheetActions>
    </Sheet>
  )
}
