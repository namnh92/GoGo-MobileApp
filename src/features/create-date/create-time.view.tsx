import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useLocaleContent } from '@/shared/i18n'
import { useRoom } from '@/shared/store/roomStore'
import { Atmosphere, BackHeader, GlassCard, PrimaryBtn, ProgressDots, glassStyles } from '@/shared/ui/primitives'
import { colors, spacing } from '@/shared/ui/tokens'
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
  const { startTime, endTime, setStartTime, setEndTime } = useRoom()
  const [selectedIndex, setSelectedIndex] = useState(1)
  const [pickerFor, setPickerFor] = useState<PickerTarget>(null)

  // Start time is mandatory (per SRS room constraints) — end stays optional.
  const canContinue = startTime !== null

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
      <View style={{ paddingTop: insets.top }}>
        <BackHeader onBack={() => router.back()} right={<Text style={styles.stepLabel}>2 / 4</Text>} />
      </View>
      <View style={{ paddingHorizontal: spacing[5], paddingBottom: spacing[4] }}>
        <ProgressDots total={4} current={1} />
      </View>
      <View style={{ flex: 1, paddingHorizontal: spacing[5] }}>
        <Text style={styles.title}>{t('createTime.title')}</Text>
        <Text style={styles.body}>{t('createTime.body')}</Text>

        <View style={{ gap: spacing[2], marginBottom: spacing[6] }}>
          {content.timeOptions.map((o, i) => {
            const active = selectedIndex === i
            return (
              <Pressable
                key={o}
                onPress={() => setSelectedIndex(i)}
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
        <PrimaryBtn label={t('common.continue')} onPress={() => router.push('/create/budget')} disabled={!canContinue} />
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
