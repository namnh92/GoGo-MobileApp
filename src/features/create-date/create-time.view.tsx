import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useLocaleContent } from '@/shared/i18n'
import { useRoom, useRoomStore } from '@/shared/store/roomStore'
import { Atmosphere, GlassCard, PrimaryBtn, glassStyles } from '@/shared/ui/primitives'
import { colors, spacing } from '@/shared/ui/tokens'
import { endSlotToIso, slotToIso } from './schedule'
import { WizardStep } from './wizard-step.view'
import { styles } from './create-time.style'

// 30-minute slots, 08:00 → 23:30 (mock — real slots come from constraints).
const TIME_SLOTS = Array.from({ length: 32 }, (_, i) => {
  const h = Math.floor(i / 2) + 8
  return `${String(h).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`
})

type PickerTarget = 'start' | 'end' | null

export default function CreateTimeScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const content = useLocaleContent()
  const { roomType, startTime, endTime, setStartTime, setEndTime } = useRoom()
  const patchDraft = useRoomStore(state => state.patchDraft)
  const [selectedIndex, setSelectedIndex] = useState(1)
  const [pickerFor, setPickerFor] = useState<PickerTarget>(null)

  // Start time is mandatory (per SRS room constraints) — end stays optional.
  const canContinue = startTime !== null

  function next() {
    const startAt = startTime ? slotToIso(startTime) : null
    patchDraft({ startAt, endAt: endTime ? endSlotToIso(endTime, startAt) : null })
    router.push('/create/budget')
  }

  function pickSlot(slot: string) {
    if (pickerFor === 'start') {
      setStartTime(slot)
      if (endTime && endTime <= slot) setEndTime(null)
    } else if (pickerFor === 'end') {
      setEndTime(slot)
    }
    setPickerFor(null)
  }

  const slotOptions = pickerFor === 'end' && startTime ? TIME_SLOTS.filter(s => s > startTime) : TIME_SLOTS

  return (
    <Atmosphere>
      <WizardStep step="time" onBack={() => router.back()} />
      <View style={{ flex: 1, paddingHorizontal: spacing[5] }}>
        <Text style={styles.title}>{t('createTime.title', { context: roomType })}</Text>
        <Text style={styles.body}>{t('createTime.body')}</Text>

        <View style={{ gap: spacing[2], marginBottom: spacing[6] }}>
          {content.timeOptions.map((o, i) => {
            const active = selectedIndex === i
            return (
              <Pressable
                key={o}
                onPress={() => setSelectedIndex(i)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.option, active ? { backgroundColor: colors.brand.coral } : glassStyles.card]}
              >
                <Text style={[styles.optionLabel, { color: active ? colors.neutral[0] : colors.neutral[900] }]}>{o}</Text>
              </Pressable>
            )
          })}
        </View>

        <GlassCard style={{ padding: spacing[4] }}>
          <Text style={styles.exactLabel}>{t('createTime.specificTime')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[4] }}>
            <Pressable
              onPress={() => setPickerFor('start')}
              accessibilityRole="button"
              style={[styles.timeBox, startTime === null && styles.timeBoxRequired]}
            >
              <Text style={styles.timeCaption}>{t('createTime.start')} *</Text>
              <Text style={[styles.timeValue, startTime === null && { color: colors.brand.coral }]}>
                {startTime ?? t('createTime.notSet')}
              </Text>
            </Pressable>
            <Text style={{ color: colors.neutral[500] }}>→</Text>
            <Pressable onPress={() => setPickerFor('end')} accessibilityRole="button" style={styles.timeBox}>
              <Text style={styles.timeCaption}>{t('createTime.end')}</Text>
              <Text style={styles.timeValue}>{endTime ?? t('createTime.notSet')}</Text>
            </Pressable>
          </View>
          {!canContinue && <Text style={styles.requiredHint}>{t('createTime.startRequired')}</Text>}
        </GlassCard>
      </View>
      <View style={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[6], paddingTop: spacing[4] }}>
        <PrimaryBtn label={t('common.continue')} onPress={next} disabled={!canContinue} />
      </View>

      {/* Time slot picker sheet */}
      <Modal visible={pickerFor !== null} transparent animationType="slide" onRequestClose={() => setPickerFor(null)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setPickerFor(null)} />
          <View style={[styles.sheet, { maxHeight: '70%' }]}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>
              {t('createTime.pickTime')} · {t(pickerFor === 'end' ? 'createTime.end' : 'createTime.start')}
            </Text>
            <ScrollView bounces={false} contentContainerStyle={[styles.slotGrid, { paddingBottom: insets.bottom + spacing[5] }]}>
              {slotOptions.map(slot => {
                const active = (pickerFor === 'start' ? startTime : endTime) === slot
                return (
                  <Pressable
                    key={slot}
                    onPress={() => pickSlot(slot)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[styles.slotBtn, active && { backgroundColor: colors.brand.coral }]}
                  >
                    <Text style={[styles.slotLabel, active && { color: colors.neutral[0] }]}>{slot}</Text>
                  </Pressable>
                )
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Atmosphere>
  )
}
