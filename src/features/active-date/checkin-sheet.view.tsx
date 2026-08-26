import * as ImagePicker from 'expo-image-picker'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import type { TimelineStop } from '@/data/types'
import { perPersonK } from '@/shared/pricing'
import { useRoom } from '@/shared/store/roomStore'
import { useLocaleContent } from '@/shared/i18n'
import type { StopCheckin } from '@/shared/store/checkinStore'
import { PrimaryBtn, RemoteImage } from '@/shared/ui/primitives'
import { colors, spacing } from '@/shared/ui/tokens'
import { styles } from './checkin-sheet.style'

const MAX_PHOTOS = 3

interface CheckinSheetProps {
  visible: boolean
  stop: TimelineStop
  /** Open with the bill section already enabled (demo/deep-link). */
  initialBillOn?: boolean
  onSave: (checkin: StopCheckin) => void
  onSkip: () => void
}

export function CheckinSheet({ visible, stop, initialBillOn = false, onSave, onSkip }: CheckinSheetProps) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const content = useLocaleContent()
  const [rating, setRating] = useState(0)
  const [tags, setTags] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const { participantCount, roomType } = useRoom()
  const participants = roomType === 'couple' ? 2 : participantCount
  const [billOn, setBillOn] = useState(initialBillOn)
  const [billTotal, setBillTotal] = useState('')
  const [billPhoto, setBillPhoto] = useState<string | null>(null)

  function reset() {
    setRating(0)
    setTags([])
    setNote('')
    setPhotos([])
    setBillOn(initialBillOn)
    setBillTotal('')
    setBillPhoto(null)
  }

  function toggleTag(tag: string) {
    setTags(prev => (prev.includes(tag) ? prev.filter(x => x !== tag) : [...prev, tag]))
  }

  async function addBillPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.7 })
    if (!result.canceled && result.assets[0]) setBillPhoto(result.assets[0].uri)
  }

  async function addPhotos() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
      quality: 0.7,
    })
    if (!result.canceled) {
      setPhotos(prev => [...prev, ...result.assets.map(a => a.uri)].slice(0, MAX_PHOTOS))
    }
  }

  const billTotalK = Number(billTotal.replace(',', '.'))
  const billValid = Number.isFinite(billTotalK) && billTotalK > 0 && billPhoto !== null
  const saveBlocked = billOn && !billValid

  function save() {
    if (saveBlocked) return
    onSave({
      rating,
      tags,
      note: note.trim(),
      photos,
      bill: billOn && billValid
        ? { totalK: billTotalK, perPersonK: perPersonK(billTotalK, participants), participants, photo: billPhoto as string }
        : undefined,
      at: new Date().toISOString(),
    })
    reset()
  }

  function skip() {
    onSkip()
    reset()
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={skip}>
      <Pressable style={styles.backdrop} onPress={skip} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing[5] }]}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <Text style={styles.headerEmoji}>{stop.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('checkin.title')}</Text>
            <Text style={styles.stopName} numberOfLines={1}>{stop.name} · {stop.area}</Text>
          </View>
        </View>

        <Text style={styles.rateLabel}>{t('checkin.rate')}</Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map(s => (
            <Pressable key={s} onPress={() => setRating(s)} accessibilityLabel={t('review.starAria', { n: s })}>
              <Text style={[styles.star, s > rating && styles.starDim]}>⭐</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.tagRow}>
          {content.reviewTags.slice(0, 4).map(tag => {
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

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
          {photos.map(uri => (
            <RemoteImage key={uri} uri={uri} style={styles.photoThumb} />
          ))}
          {photos.length < MAX_PHOTOS && (
            <Pressable onPress={addPhotos} accessibilityRole="button" style={styles.addPhotoBtn}>
              <Text style={styles.addPhotoLabel}>{t('checkin.addPhoto')}</Text>
              {photos.length > 0 && <Text style={styles.photoCount}>{t('checkin.photoCount', { n: photos.length })}</Text>}
            </Pressable>
          )}
        </ScrollView>

        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={t('checkin.notePlaceholder')}
          placeholderTextColor={colors.neutral[300]}
          multiline
          style={styles.input}
        />

        {/* Bill check-in (FR-PLAN-008): photo mandatory when enabled */}
        <Pressable
          onPress={() => setBillOn(v => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: billOn }}
          style={[styles.billToggle, billOn && styles.billToggleOn]}
        >
          <Text style={[styles.billToggleLabel, billOn && styles.billToggleLabelOn]}>{t('checkin.billToggle')}</Text>
          <Text style={styles.billToggleMark}>{billOn ? '✓' : ''}</Text>
        </Pressable>
        {billOn && (
          <View style={styles.billBox}>
            <Text style={styles.billHint}>{t('checkin.billHint')}</Text>
            <TextInput
              value={billTotal}
              onChangeText={setBillTotal}
              placeholder={t('checkin.billTotal')}
              placeholderTextColor={colors.neutral[300]}
              keyboardType="numeric"
              style={styles.billInput}
            />
            {Number.isFinite(billTotalK) && billTotalK > 0 && (
              <Text style={styles.billPerPerson}>
                {t('checkin.billPerPerson', { amount: `${perPersonK(billTotalK, participants)}k`, n: participants })}
              </Text>
            )}
            <Pressable onPress={addBillPhoto} style={[styles.billPhotoBtn, billPhoto && styles.billPhotoDone]}>
              <Text style={[styles.billPhotoLabel, billPhoto && styles.billPhotoLabelDone]}>
                {billPhoto ? t('checkin.billPhotoDone') : t('checkin.billPhoto')}
              </Text>
            </Pressable>
            {saveBlocked && <Text style={styles.billRequired}>{t('checkin.billRequired')}</Text>}
          </View>
        )}

        <PrimaryBtn label={t('checkin.save')} onPress={save} disabled={saveBlocked} style={styles.saveBtn} />
        <Pressable onPress={skip} style={styles.skipBtn}>
          <Text style={styles.skipLabel}>{t('checkin.skip')}</Text>
        </Pressable>
      </View>
    </Modal>
  )
}
