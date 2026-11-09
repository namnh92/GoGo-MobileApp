import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, View } from 'react-native'
import i18n from '@/shared/i18n'

import { useRoom, useRoomStore, type DurationPresetKey } from '@/shared/store/roomStore'
import { GlassBar, useBottomBarInset } from '@/shared/ui/glass-bar.view'
import { Atmosphere, glassStyles, PrimaryBtn } from '@/shared/ui/primitives'
import { Icon } from '@/shared/ui/icons'
import { Sheet } from '@/shared/ui/sheet.view'
import { Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'
import { DURATION_PRESETS, presetEnd } from './duration-presets'
import { DateTimeSheet } from './date-time-sheet.view'
import { dayTimeLabel, dayLabel } from './day-format'
import { isPastSlot, parseDayKey } from './calendar'
import { freshDay, scheduleToIso } from './schedule-day'
import { TIME_SLOTS } from './time-slots'
import { WizardStep } from './wizard-step.view'
import { styles } from './create-time.style'

type PickerTarget = 'end' | null

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
  const [dateSheet, setDateSheet] = useState(false)

  // No chosen day, or one that has passed, is today.
  const now = new Date()
  const day = freshDay(scheduleDay, now)
  const locale = i18n.language
  const startDate = (day ? parseDayKey(day) : null) ?? now

  // Start time is mandatory (per SRS room constraints) — end stays optional.
  // A start already over today is shown as invalid and blocks Continue: the slot
  // helpers would roll it to tomorrow, and the row must never say today while
  // the room is made for tomorrow.
  const startPast = startTime !== null && isPastSlot(startTime, day, now)
  const canContinue = startTime !== null && !startPast
  // "01:00" after "23:00" is tomorrow; `endSlotToIso` rolls it forward the same way.
  // Display only: what the two times add up to, rolling past midnight like `endSlotToIso`.
  const spanHours = startTime !== null && endTime !== null ? hoursBetween(startTime, endTime) : null
  const endsNextDay = startTime !== null && endTime !== null && endTime <= startTime
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + (endsNextDay ? 1 : 0))

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

  function applyStart(slot: string) {
    setStartTime(slot)
    if (durationPreset) setEndTime(presetEnd(slot, durationPreset))
    else if (endTime && endTime <= slot) setEndTime(null)
  }

  function finishDateSheet(chosenDay: string | null, slot: string) {
    patchDraft({ scheduleDay: chosenDay })
    applyStart(slot)
    setDateSheet(false)
  }

  function pickSlot(slot: string) {
    setEndTime(slot)
    // A hand-picked end replaces whatever length was chosen.
    setDurationPreset(null)
    setPickerFor(null)
  }

  // #333: at 375pt the end-time row ran under the bar; the step scrolls now.
  const [footerHeight, setFooterHeight] = useState(0)
  const footerInset = useBottomBarInset(footerHeight)

  const slotOptions = startTime ? TIME_SLOTS.filter(s => s > startTime) : TIME_SLOTS

  return (
    <Atmosphere redesign>
      <WizardStep step="time" onBack={() => router.back()} />
      <ScrollView
        testID="create-time-scroll"
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: footerInset + spacing[4] }]}
      >
        <Text variant="discoveryTitle">{t('createTime.title', { context: roomType })}</Text>
        <Text color="text.secondary" style={styles.body}>{t('createTime.body')}</Text>

        {!dateSheet && pickerFor === null ? <DateTimeSheet
          key={`${day}-${startTime}`}
          inline visible initialDay={day} initialTime={startTime}
          onDayChange={scheduleDay => patchDraft({ scheduleDay })}
          onClose={() => setDateSheet(false)} onDone={finishDateSheet}
        /> : null}

        {/* Summary reopens the staged picker; optional end/duration remain available. */}
        <View style={styles.rows}>
          <Pressable
            onPress={() => setDateSheet(true)}
            accessibilityRole="button"
            accessibilityLabel={`${t('createTime.start')}: ${startTime ? dayTimeLabel(startDate, startTime, locale) : t('createTime.notSet')}`}
            testID="create-time-start-row"
            style={[styles.row, startTime === null && styles.rowRequired, startPast && styles.rowInvalid]}
          >
            <Icon name="calendar" size={20} color={startPast ? 'status.dangerText' : 'accent.primary'} />
            <Text variant="label" color="text.secondary">{t('createTime.start')} *</Text>
            <Text
              variant="discoveryHeading"
              color={startPast ? 'status.dangerText' : startTime === null ? 'accent.primary' : 'text.primary'}
              numberOfLines={1}
              style={styles.rowValue}
            >
              {startTime ? dayTimeLabel(startDate, startTime, locale) : `${dayLabel(startDate, locale)} · ${t('createTime.notSet')}`}
            </Text>
            <Icon name="chevronRight" size={16} color="text.secondary" />
          </Pressable>
          <Pressable
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
          {!canContinue && !startPast ? (
            <Text variant="caption" color="accent.primary" style={styles.requiredHint}>
              {t(durationPreset ? 'createTime.presetNeedsStart' : 'createTime.startRequired')}
            </Text>
          ) : null}
        </View>
        {spanHours !== null ? (
          <Text variant="bodySmall" color="text.secondary" style={styles.estimate}>
            {t('createTime.estimated', { hours: spanHours })}
          </Text>
        ) : null}

        <Text variant="bodySmall" color="text.secondary" style={styles.exactLabel}>{t('createTime.durationLabel')}</Text>
        <View style={styles.options}>
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
                <Text variant="discoveryHeading" color={active ? 'accent.onSoft' : 'text.primary'}>{label}</Text>
                {/* Selection is never colour alone. */}
                {active ? <Text variant="discoveryHeading" color="accent.onSoft">✓</Text> : null}
              </Pressable>
            )
          })}
        </View>

      </ScrollView>
      <GlassBar placement="floating" testID="create-footer" onHeightChange={setFooterHeight}>
        <PrimaryBtn variant="stitch" label={t('common.continue')} onPress={next} disabled={!canContinue} icon="arrowRight" />
      </GlassBar>

      <DateTimeSheet
        visible={dateSheet}
        initialDay={day}
        initialTime={startTime}
        onClose={() => setDateSheet(false)}
        onDone={finishDateSheet}
      />

      {/* End time: the 30-minute slot grid. */}
      <Sheet visible={pickerFor !== null} onClose={() => setPickerFor(null)} maxHeight="70%">
        <Text variant="title1" style={styles.sheetTitle}>
          {t('createTime.pickTime')} · {t('createTime.end')}
        </Text>
        <View style={styles.slotGrid}>
          {slotOptions.map(slot => {
            const active = endTime === slot
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
