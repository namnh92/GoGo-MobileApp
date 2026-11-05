import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, View } from 'react-native'
import i18n from '@/shared/i18n'

import { useRoom, useRoomStore, type DurationPresetKey } from '@/shared/store/roomStore'
import { GlassBar, useBottomBarInset } from '@/shared/ui/glass-bar.view'
import { Atmosphere, Card, glassStyles, PrimaryBtn } from '@/shared/ui/primitives'
import { Icon } from '@/shared/ui/icons'
import { Sheet } from '@/shared/ui/sheet.view'
import { Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'
import { DURATION_PRESETS, presetEnd } from './duration-presets'
import { freshDay, localDayKey, scheduleToIso, upcomingDays } from './schedule-day'
import { WizardStep } from './wizard-step.view'
import { styles } from './create-time.style'

// 30-minute slots, 08:00 → 23:30 (mock — real slots come from constraints).
const TIME_SLOTS = Array.from({ length: 32 }, (_, i) => {
  const h = Math.floor(i / 2) + 8
  return `${String(h).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`
})

const upper = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1)

type PickerTarget = 'start' | 'end' | null

/** Whole and half hours from `start` to `end` ("HH:MM"); an end at or before the start is the next day. */
function hoursBetween(start: string, end: string): number {
  const minutes = (slot: string) => Number(slot.slice(0, 2)) * 60 + Number(slot.slice(3))
  const span = (minutes(end) - minutes(start) + 24 * 60) % (24 * 60) || 24 * 60
  return Math.round(span / 30) / 2
}

/**
 * APP-051 (#204): a length preset is not an alternative to a start time — the
 * contract has no duration field (see `duration-presets.ts`). It fills in the
 * end once a start exists, and Continue is never unlocked by an invented time.
 */
export default function CreateTimeScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { roomType, startTime, endTime, setStartTime, setEndTime } = useRoom()
  const durationPreset = useRoomStore(state => state.durationPreset)
  const setDurationPreset = useRoomStore(state => state.setDurationPreset)
  const scheduleDay = useRoomStore(state => state.scheduleDay)
  const patchDraft = useRoomStore(state => state.patchDraft)
  const [pickerFor, setPickerFor] = useState<PickerTarget>(null)

  // No chosen day, or one that has passed, is today: the screen behaves as it did before the row.
  const now = new Date()
  const day = freshDay(scheduleDay, now)
  const days = upcomingDays(now)
  const selectedKey = day ?? localDayKey(now)
  const locale = i18n.language
  const monthLabel = upper(
    (days.find(d => d.key === selectedKey)?.date ?? now).toLocaleDateString(locale, { month: 'long', year: 'numeric' }),
  )

  function chooseDay(key: string) {
    patchDraft({ scheduleDay: key === localDayKey(now) ? null : key })
  }

  function dayLabel(index: number, date: Date) {
    if (index === 0) return t('createTime.today')
    if (index === 1) return t('createTime.tomorrow')
    return date.toLocaleDateString(locale, { weekday: 'long', day: '2-digit', month: '2-digit' })
  }

  // Start time is mandatory (per SRS room constraints) — end stays optional.
  const canContinue = startTime !== null
  // "01:00" after "23:00" is tomorrow; `endSlotToIso` rolls it forward the same way.
  // Display only: what the two times add up to, rolling past midnight like `endSlotToIso`.
  const spanHours = startTime !== null && endTime !== null ? hoursBetween(startTime, endTime) : null
  const endsNextDay = startTime !== null && endTime !== null && endTime <= startTime

  function next() {
    patchDraft(scheduleToIso(startTime, endTime, day))
    router.push('/create/budget')
  }

  function choosePreset(key: DurationPresetKey) {
    if (durationPreset === key) {
      setDurationPreset(null)
      // Only an end this preset produced leaves with it; a hand-picked one stays.
      if (startTime && endTime === presetEnd(startTime, key)) setEndTime(null)
      return
    }
    setDurationPreset(key)
    if (startTime) setEndTime(presetEnd(startTime, key))
  }

  function pickSlot(slot: string) {
    if (pickerFor === 'start') {
      setStartTime(slot)
      if (durationPreset) setEndTime(presetEnd(slot, durationPreset))
      else if (endTime && endTime <= slot) setEndTime(null)
    } else if (pickerFor === 'end') {
      setEndTime(slot)
      // A hand-picked end replaces whatever length was chosen.
      setDurationPreset(null)
    }
    setPickerFor(null)
  }

  // #333: at 375pt the end-time row ran under the bar; the step scrolls now.
  const [footerHeight, setFooterHeight] = useState(0)
  const footerInset = useBottomBarInset(footerHeight)

  const slotOptions = pickerFor === 'end' && startTime ? TIME_SLOTS.filter(s => s > startTime) : TIME_SLOTS

  return (
    <Atmosphere>
      <WizardStep step="time" onBack={() => router.back()} />
      <ScrollView
        testID="create-time-scroll"
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: footerInset + spacing[4] }]}
      >
        <Text variant="display">{t('createTime.title', { context: roomType })}</Text>
        <Text color="text.secondary" style={styles.body}>{t('createTime.body')}</Text>

        <View style={styles.dayHeader}>
          <Icon name="calendar" size={20} color="accent.primary" />
          <Text variant="title2" style={styles.dayTitle}>{t('createTime.dayTitle')}</Text>
          <Text variant="caption" color="text.secondary" numberOfLines={1}>{monthLabel}</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          testID="create-time-days"
          style={styles.dayScroll}
          contentContainerStyle={styles.dayRow}
        >
          {days.map(({ key, date }, index) => {
            const active = key === selectedKey
            const label = dayLabel(index, date)
            return (
              <Pressable
                key={key}
                onPress={() => chooseDay(key)}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: active }}
                testID={`create-time-day-${key}`}
                style={[styles.dayChip, active ? styles.dayChipActive : glassStyles.card]}
              >
                {/* Selection is never colour alone: a check and a heavier label. */}
                {active ? <Icon name="check" size={14} color="accent.onSoft" /> : null}
                <Text variant={active ? 'label' : 'bodySmall'} color={active ? 'accent.onSoft' : 'text.primary'} numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>

        <Text variant="bodySmall" color="text.secondary" style={styles.exactLabel}>{t('createTime.durationLabel')}</Text>
        <View style={{ gap: spacing[2], marginBottom: spacing[6] }}>
          {DURATION_PRESETS.map(preset => {
            const active = durationPreset === preset.key
            const label = t(`createTime.preset.${preset.key}`)
            return (
              <Pressable
                key={preset.key}
                onPress={() => choosePreset(preset.key)}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: active }}
                style={[styles.option, active ? styles.optionActive : glassStyles.card]}
              >
                <Text variant="title2" color={active ? 'accent.onSoft' : 'text.primary'}>{label}</Text>
                {/* Selection is never colour alone. */}
                {active ? <Text variant="title2" color="accent.onSoft">✓</Text> : null}
              </Pressable>
            )
          })}
        </View>

        <Card padded={false} style={{ padding: spacing[4] }}>
          <Text variant="bodySmall" color="text.secondary" style={styles.exactLabel}>{t('createTime.specificTime')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[4] }}>
            <Pressable
              onPress={() => setPickerFor('start')}
              accessibilityRole="button"
              style={[styles.timeBox, startTime === null && styles.timeBoxRequired]}
            >
              <Text variant="caption" color="text.secondary">{t('createTime.start')} *</Text>
              <Text variant="title1" color={startTime === null ? 'accent.primary' : 'text.primary'} style={styles.timeValue}>
                {startTime ?? t('createTime.notSet')}
              </Text>
            </Pressable>
            <Text color="text.secondary">→</Text>
            <Pressable onPress={() => setPickerFor('end')} accessibilityRole="button" style={styles.timeBox}>
              <Text variant="caption" color="text.secondary">{t('createTime.end')}</Text>
              <Text variant="title1" style={styles.timeValue}>
                {endTime ?? t(durationPreset === 'evening' ? 'createTime.openEnd' : 'createTime.notSet')}
              </Text>
              {endsNextDay ? <Text variant="caption" color="text.secondary">{t('createTime.nextDay')}</Text> : null}
            </Pressable>
          </View>
          {!canContinue && (
            <Text variant="caption" color="accent.primary" style={styles.requiredHint}>
              {t(durationPreset ? 'createTime.presetNeedsStart' : 'createTime.startRequired')}
            </Text>
          )}
        </Card>
        {spanHours !== null ? (
          <Text variant="bodySmall" color="text.secondary" style={styles.estimate}>
            {t('createTime.estimated', { hours: spanHours })}
          </Text>
        ) : null}
      </ScrollView>
      <GlassBar placement="floating" testID="create-footer" onHeightChange={setFooterHeight}>
        <PrimaryBtn label={t('common.continue')} onPress={next} disabled={!canContinue} icon="arrowRight" />
      </GlassBar>

      {/* Time slot picker sheet */}
      <Sheet visible={pickerFor !== null} onClose={() => setPickerFor(null)} maxHeight="70%">
        <Text variant="title1" style={styles.sheetTitle}>
          {t('createTime.pickTime')} · {t(pickerFor === 'end' ? 'createTime.end' : 'createTime.start')}
        </Text>
        <View style={styles.slotGrid}>
          {slotOptions.map(slot => {
            const active = (pickerFor === 'start' ? startTime : endTime) === slot
            return (
              <Pressable
                key={slot}
                onPress={() => pickSlot(slot)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.slotBtn, active && styles.slotBtnActive]}
              >
                <Text variant="label" color={active ? 'accent.onAccent' : 'text.primary'}>{slot}</Text>
              </Pressable>
            )
          })}
        </View>
      </Sheet>
    </Atmosphere>
  )
}
