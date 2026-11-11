import { SheetActions } from '@/shared/ui/sheet-actions.view'
import { Chip } from '@/shared/ui/chip.view'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, View } from 'react-native'
import i18n from '@/shared/i18n'

import { Icon } from '@/shared/ui/icons'
import { PrimaryBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { Sheet } from '@/shared/ui/sheet.view'
import { Text } from '@/shared/ui/text'
import { TimeWheel } from '@/shared/ui/time-wheel.view'
import { TimePickerSheet } from './time-picker-sheet.view'
import { dayTimeLabel, monthLabel, weekdayShort } from './day-format'
import { isPastSlot, monthGrid, parseDayKey } from './calendar'
import { localDayKey } from './schedule-day'
import { EVENING_STARTS, TIME_SLOTS } from './time-slots'
import { styles } from './date-time-sheet.style'

/** Calendar and evening chips share staged sheet semantics; inline edits use the existing draft callbacks. */
export function DateTimeSheet({ inline = false, visible, initialDay, initialTime, onDayChange, onClose, onDone }: {
  inline?: boolean
  visible: boolean
  /** `YYYY-MM-DD`, or null for today. */
  initialDay: string | null
  initialTime: string | null
  /** Inline day-only edits belong to the draft even before a time is chosen. */
  onDayChange?: (day: string | null) => void
  onClose: () => void
  onDone: (day: string | null, time: string) => void
}) {
  const { t } = useTranslation()
  const locale = i18n.language
  const now = new Date()
  const todayKey = localDayKey(now)

  const [day, setDay] = useState(initialDay ?? todayKey)
  const [time, setTime] = useState<string | null>(initialTime)
  const [view, setView] = useState<{ year: number; month: number }>(() => monthOf(initialDay ?? todayKey))
  const [slots, setSlots] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [wheelTime, setWheelTime] = useState(initialTime ?? '19:00')

  // Edits start from the draft each time the sheet opens (derived while
  // rendering, so the first frame is already the fresh one).
  const [seenVisible, setSeenVisible] = useState(visible)
  if (seenVisible !== visible) {
    setSeenVisible(visible)
    if (visible) {
      const key = initialDay ?? todayKey
      setDay(key)
      setTime(initialTime)
      setView(monthOf(key))
      setSlots(false)
      setExpanded(false)
    }
  }

  const pickedDay = parseDayKey(day) ?? now
  const dayArg = day === todayKey ? null : day
  const past = time !== null && isPastSlot(time, dayArg, now)
  const canDone = time !== null && !past
  const onCurrentMonth = view.year === now.getFullYear() && view.month === now.getMonth()

  function chooseDay(key: string) {
    setDay(key)
    setView(monthOf(key))
    const nextDay = key === todayKey ? null : key
    if (inline) {
      if (time !== null) onDone(nextDay, time)
      else onDayChange?.(nextDay)
    }
  }

  function chooseTime(slot: string) {
    setTime(slot)
    if (inline) onDone(dayArg, slot)
  }

  const prefix = inline ? 'date-inline' : 'date-sheet'

  function shift(delta: number) {
    const next = new Date(view.year, view.month + delta, 1)
    setView({ year: next.getFullYear(), month: next.getMonth() })
  }

  const weeks = monthGrid(view.year, view.month)
  const weekAnchor = view.year === pickedDay.getFullYear() && view.month === pickedDay.getMonth()
    ? pickedDay : new Date(view.year, view.month, onCurrentMonth ? now.getDate() : 1)
  const monday = weekAnchor.getDate() - (weekAnchor.getDay() + 6) % 7
  const collapsedWeek = Array.from({ length: 7 }, (_, i) => new Date(view.year, view.month, monday + i))
  const visibleWeeks = expanded ? weeks : [collapsedWeek]
  const wheelDefault = time ?? TIME_SLOTS.find(slot => !isPastSlot(slot, dayArg, now)) ?? '23:59'
  function openWheel() { setWheelTime(wheelDefault); setSlots(true) }

  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2026, 10, 2 + i))

  const content = (
    <>
      {!inline ? <View style={styles.head}>
        <Text variant="title1" style={styles.headTitle}>{t('createTime.sheetTitle')}</Text>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} testID={`${prefix}-close`} style={styles.iconBtn}>
          <Icon name="x" size={22} />
        </Pressable>
      </View> : null}

      {slots && !inline ? (
        <>
          <Text variant="title2" style={styles.sectionHead}>{t('createTime.pickTime')} · {t('createTime.start')}</Text>
          <TimeWheel value={wheelTime} onChange={setWheelTime} testID="date-sheet-wheel" />
          {isPastSlot(wheelTime, dayArg, now) ? <Text color="status.dangerText" accessibilityLiveRegion="polite">{t('createTime.startPast')}</Text> : null}
          <SheetActions><SecondaryBtn label={t('common.cancel')} onPress={() => setSlots(false)} /><PrimaryBtn
            label={t('createTime.done')} disabled={isPastSlot(wheelTime, dayArg, now)}
            onPress={() => { chooseTime(wheelTime); setSlots(false) }} /></SheetActions>
        </>
      ) : (
        <>
          <View style={inline ? styles.calendar : undefined}>
          <View style={styles.monthRow}>
            <Pressable
              onPress={() => shift(-1)}
              disabled={onCurrentMonth}
              accessibilityRole="button"
              accessibilityLabel={t('createTime.prevMonth')}
              accessibilityState={{ disabled: onCurrentMonth }}
              testID="date-sheet-prev"
              style={[styles.iconBtn, onCurrentMonth && styles.iconBtnOff]}
            >
              <Icon name="chevronLeft" size={20} />
            </Pressable>
            <Text variant="title2" style={styles.monthTitle}>{monthLabel(view.year, view.month, locale)}</Text>
            <Pressable
              onPress={() => shift(1)}
              accessibilityRole="button"
              accessibilityLabel={t('createTime.nextMonth')}
              testID="date-sheet-next"
              style={styles.iconBtn}
            >
              <Icon name="chevronRight" size={20} />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {weekdays.map(date => (
              <View key={date.getDay()} style={styles.weekday}>
                <Text variant="caption" color="text.secondary">
                  {weekdayShort(date, locale)}
                </Text>
              </View>
            ))}
          </View>
          {visibleWeeks.map((week, w) => (
            <View key={w} testID={`${prefix}-week`} style={styles.weekRow}>
              {week.map((date, i) => {
                if (!date) return <View key={i} style={styles.cellWrap} />
                const key = localDayKey(date)
                const off = key < todayKey
                const selected = key === day
                const isToday = key === todayKey
                const label = date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
                return (
                  <View key={i} style={styles.cellWrap}>
                    <Pressable
                      disabled={off}
                      onPress={() => chooseDay(key)}
                      accessibilityRole="button"
                      accessibilityLabel={isToday ? `${label}, ${t('createTime.today')}` : label}
                      accessibilityState={{ selected, disabled: off }}
                      testID={`${prefix}-day-${key}`}
                      style={[styles.cell, selected && styles.cellSelected, off && styles.cellOff]}
                    >
                      <Text
                        variant={selected ? 'label' : 'bodySmall'}
                        color={selected ? 'accent.onAccent' : 'text.primary'}
                      >
                        {date.getDate()}
                      </Text>
                      {isToday ? <View style={[styles.todayDot, selected && styles.todayDotOnSelected]} /> : null}
                    </Pressable>
                  </View>
                )
              })}
            </View>
          ))}

          <Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={t(expanded ? 'createTime.collapseCalendar' : 'createTime.expandCalendar')}
            testID={`${prefix}-expand`} style={styles.expand} onPress={() => setExpanded(value => !value)}>
            <Text variant="label" color="accent.primary">{t(expanded ? 'createTime.collapseCalendar' : 'createTime.expandCalendar')}</Text>
          </Pressable>
          </View>
          <View style={styles.sectionHead}>
            <Icon name="clock" size={18} />
            <Text variant="title2">{t('createTime.startTimeLabel')}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeRow}>
            {EVENING_STARTS.map(slot => {
              const off = isPastSlot(slot, dayArg, now)
              const active = time === slot
              return (
                <Chip key={slot} label={slot} appearance="raised" variant={active ? 'selected' : 'default'} disabled={off}
                  onPress={() => chooseTime(slot)} testID={`${prefix}-time-${slot}`} />
              )
            })}
            <Chip label={t('createTime.otherTime')} appearance="raised"
              variant={time !== null && !(EVENING_STARTS as readonly string[]).includes(time) ? 'selected' : 'default'}
              onPress={openWheel} testID={`${prefix}-other-time`} />
          </ScrollView>

          {!inline ? <View testID="date-sheet-summary" style={[styles.summary, past && styles.summaryInvalid]}>
            <Icon name="calendar" size={18} color={past ? 'status.dangerText' : 'accent.onSoft'} />
            <Text variant="label" color={past ? 'status.dangerText' : 'accent.onSoft'} style={styles.headTitle}>
              {dayTimeLabel(pickedDay, time ?? t('createTime.notSet'), locale)}
            </Text>
          </View> : null}
          {past && !inline ? <Text variant="caption" color="status.dangerText">{t('createTime.startPast')}</Text> : null}
        </>
      )}

      {inline ? <TimePickerSheet visible={slots} initialTime={wheelDefault} title={`${t('createTime.pickTime')} · ${t('createTime.start')}`}
        isInvalid={slot => isPastSlot(slot, dayArg, new Date())} invalidHint={t('createTime.startPast')}
        onClose={() => setSlots(false)} onDone={slot => { setSlots(false); chooseTime(slot) }} testID="start-time-sheet" /> : null}
      {slots || inline ? null : (
        <SheetActions><SecondaryBtn label={t('common.cancel')} onPress={onClose} /><PrimaryBtn
          label={t('createTime.done')}
          disabled={!canDone}
          onPress={() => onDone(dayArg, time as string)}
        /></SheetActions>
      )}
    </>
  )
  return inline ? <View testID="date-time-inline">{content}</View> : (
    <Sheet visible={visible} onClose={onClose} maxHeight="92%" testID="date-time-sheet">{content}</Sheet>
  )
}

function monthOf(key: string): { year: number; month: number } {
  const date = parseDayKey(key) ?? new Date()
  return { year: date.getFullYear(), month: date.getMonth() }
}
