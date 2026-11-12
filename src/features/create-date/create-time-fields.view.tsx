import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'
import i18n from '@/shared/i18n'
import type { DurationPresetKey } from '@/shared/store/roomStore'
import { glassStyles } from '@/shared/ui/primitives'
import { Icon } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'
import { TimePickerSheet } from './time-picker-sheet.view'
import { DURATION_PRESETS, presetEnd } from './duration-presets'
import { TIME_SLOTS } from './time-slots'
import { DateTimeSheet } from './date-time-sheet.view'
import { dayTimeLabel, dayLabel } from './day-format'
import { isPastSlot, parseDayKey } from './calendar'
import { styles } from './create-time-fields.style'
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
export function CreateTimeFields({ roomType, startTime, endTime, setStartTime, setEndTime, setPresetEndTime, durationPreset, setDurationPreset, scheduleDay, onDayChange, selectedEndDate, disabled = false, sectionTitle, mode = 'create', showDurationPresets = true }: {
  mode?: 'create' | 'edit'
  showDurationPresets?: boolean
  sectionTitle?: string
  disabled?: boolean
  roomType: 'couple' | 'group'
  startTime: string | null
  endTime: string | null
  setStartTime: (value: string | null) => void
  setEndTime: (value: string | null) => void
  /** A duration edit derives a new end day from the start; a time-only edit keeps its day. */
  setPresetEndTime?: (value: string | null) => void
  durationPreset: DurationPresetKey | null
  setDurationPreset: (value: DurationPresetKey | null) => void
  scheduleDay: string | null
  onDayChange: (day: string | null) => void
  /** Editing a stored custom multi-day window must display its real end day. */
  selectedEndDate?: Date
}) {
  const { t } = useTranslation()
  const [pickerFor, setPickerFor] = useState<PickerTarget>(null)

  // Creation resolves day defaults in its wrapper; edit passes the stored day.
  const now = new Date()
  const day = scheduleDay
  const locale = i18n.language
  const startDate = (day ? parseDayKey(day) : null) ?? now

  // Start time is mandatory (per SRS room constraints) — end stays optional.
  // A start already over today is shown as invalid and blocks Continue: the slot
  // helpers would roll it to tomorrow, and the row must never say today while
  // the room is made for tomorrow.
  const startPast = mode === 'create' && startTime !== null && isPastSlot(startTime, day, now)
  const canContinue = startTime !== null && !startPast
  // "01:00" after "23:00" is tomorrow; `endSlotToIso` rolls it forward the same way.
  // Display only: what the two times add up to, rolling past midnight like `endSlotToIso`.
  const spanHours = startTime !== null && endTime !== null
    ? selectedEndDate ? Math.round((selectedEndDate.getTime() - new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), Number(startTime.slice(0, 2)), Number(startTime.slice(3))).getTime()) / 1800000) / 2
      : hoursBetween(startTime, endTime) : null
  const endsNextDay = selectedEndDate
    ? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 1).toDateString() === selectedEndDate.toDateString()
    : startTime !== null && endTime !== null && endTime <= startTime
  const endDate = selectedEndDate ?? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + (endsNextDay ? 1 : 0))

  function choosePreset(key: DurationPresetKey) {
    if (durationPreset === key) {
      setDurationPreset(null)
      // Only an end this preset produced leaves with it; a hand-picked one stays.
      if (startTime && endTime === presetEnd(startTime, key)) setEndTime(null)
      return
    }
    setDurationPreset(key)
    if (startTime) (setPresetEndTime ?? setEndTime)(presetEnd(startTime, key))
  }

  function applyStart(slot: string) {
    setStartTime(slot)
    if (durationPreset) (setPresetEndTime ?? setEndTime)(presetEnd(slot, durationPreset))
    else if (!selectedEndDate && endTime && endTime <= slot) setEndTime(null)
  }

  function pickSlot(slot: string) {
    if (pickerFor === 'start') applyStart(slot)
    else {
      setEndTime(slot)
      // A hand-picked end replaces whatever length was chosen.
      setDurationPreset(null)
    }
    setPickerFor(null)
  }

  return <View testID="create-time-section">
        {sectionTitle ? <Text variant="label" style={styles.sectionHeading}>{sectionTitle}</Text> : <>
        <Text variant="discoveryTitle">{t('createTime.title', { context: roomType })}</Text>
        <Text color="text.secondary" style={styles.body}>{t('createTime.body')}</Text>
        </>}

        <DateTimeSheet initialDay={day} onDayChange={onDayChange} disabled={disabled} selectTodayByDefault={mode === 'create'} />

        <View style={styles.rows}>
          <Pressable
            disabled={disabled} accessibilityState={{ disabled }}
            onPress={() => setPickerFor('start')}
            accessibilityRole="button"
            accessibilityLabel={`${t('createTime.start')}: ${startTime ? dayTimeLabel(startDate, startTime, locale) : t('createTime.notSet')}`}
            testID="create-time-start-row"
            style={[styles.row, mode === 'create' && startTime === null && styles.rowRequired, startPast && styles.rowInvalid]}
          >
            <Icon name="calendar" size={20} color={startPast ? 'status.dangerText' : 'accent.primary'} />
            <Text variant="label" color="text.secondary">{t('createTime.start')} *</Text>
            <Text
              variant="discoveryHeading"
              color={startPast ? 'status.dangerText' : mode === 'create' && startTime === null ? 'accent.primary' : 'text.primary'}
              numberOfLines={1}
              style={styles.rowValue}
            >
              {startTime ? dayTimeLabel(startDate, startTime, locale) : mode === 'edit' && !day ? t('createTime.notSet') : `${dayLabel(startDate, locale)} · ${t('createTime.notSet')}`}
            </Text>
            <Icon name="chevronRight" size={16} color="text.secondary" />
          </Pressable>
          <Pressable
            disabled={disabled} accessibilityState={{ disabled }}
            onPress={() => setPickerFor('end')}
            accessibilityRole="button"
            accessibilityLabel={`${t('createTime.end')}: ${endTime ? dayTimeLabel(endDate, endTime, locale) : t('createTime.notSet')}`}
            testID="create-time-end-row"
            style={styles.row}
          >
            <Icon name="calendar" size={20} color="text.secondary" />
            <Text variant="label" color="text.secondary">{t('createTime.end')}</Text>
            <Text variant="discoveryHeading" numberOfLines={1} style={styles.rowValue}>
              {endTime
                ? dayTimeLabel(endDate, endTime, locale)
                : t(durationPreset === 'evening' ? 'createTime.openEnd' : 'createTime.notSet')}
            </Text>
            {endsNextDay ? <Text variant="caption" color="text.secondary" numberOfLines={1}>{t('createTime.nextDay')}</Text> : null}
            <Icon name="chevronRight" size={16} color="text.secondary" />
          </Pressable>
          {startPast ? (
            <Text variant="caption" color="status.dangerText" style={styles.requiredHint}>{t('createTime.startPast')}</Text>
          ) : null}
          {mode === 'create' && !canContinue && !startPast ? (
            <Text variant="caption" color="accent.primary" style={styles.requiredHint}>
              {t(durationPreset ? 'createTime.presetNeedsStart' : 'createTime.startRequired')}
            </Text>
          ) : null}
        </View>
        {showDurationPresets && spanHours !== null ? (
          <Text variant="bodySmall" color="text.secondary" style={styles.estimate}>
            {t('createTime.estimated', { hours: spanHours })}
          </Text>
        ) : null}

        {showDurationPresets ? <>
        <Text variant="bodySmall" color="text.secondary" style={styles.exactLabel}>{t('createTime.durationLabel')}</Text>
        <View style={styles.options}>
          {DURATION_PRESETS.map(preset => {
            const active = durationPreset === preset.key
            const label = t(`createTime.preset.${preset.key}`)
            return (
              <Pressable
                key={preset.key}
                disabled={disabled} onPress={() => choosePreset(preset.key)}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: active, disabled }}
                style={[styles.option, active ? styles.optionActive : glassStyles.card]}
              >
                <Text variant="discoveryHeading" color={active ? 'accent.onSoft' : 'text.primary'}>{label}</Text>
                {/* Selection is never colour alone. */}
                {active ? <Text variant="discoveryHeading" color="accent.onSoft">✓</Text> : null}
              </Pressable>
            )
          })}
        </View>
        </> : null}

      <TimePickerSheet visible={!disabled && pickerFor === 'start'} initialTime={startTime ?? TIME_SLOTS.find(slot => !isPastSlot(slot, day, now)) ?? '23:59'}
        title={`${t('createTime.pickTime')} · ${t('createTime.start')}`}
        isInvalid={slot => isPastSlot(slot, day, new Date())} invalidHint={t('createTime.startPast')}
        onClose={() => setPickerFor(null)} onDone={pickSlot} testID="start-time-sheet" />
      <TimePickerSheet visible={!disabled && pickerFor === 'end'} initialTime={endTime ?? startTime ?? '19:00'}
        title={`${t('createTime.pickTime')} · ${t('createTime.end')}`}
        isInvalid={slot => startTime !== null && (selectedEndDate
          ? new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), Number(slot.slice(0, 2)), Number(slot.slice(3))).getTime()
            <= new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), Number(startTime.slice(0, 2)), Number(startTime.slice(3))).getTime()
          : slot <= startTime)}
        invalidHint={t('createTime.endAfterStart')}
        onClose={() => setPickerFor(null)} onDone={pickSlot} testID="end-time-sheet" />

  </View>
}
