import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, View } from 'react-native'
import i18n from '@/shared/i18n'

import { Icon } from '@/shared/ui/icons'
import { PrimaryBtn } from '@/shared/ui/primitives'
import { Sheet } from '@/shared/ui/sheet.view'
import { Text } from '@/shared/ui/text'
import { dayLabel, dayTimeLabel, monthLabel, weekdayShort } from './day-format'
import { isPastSlot, monthGrid, parseDayKey, weekendDay } from './calendar'
import { localDayKey } from './schedule-day'
import { EVENING_STARTS, TIME_SLOTS } from './time-slots'
import { styles } from './date-time-sheet.style'

/**
 * The start's day and time (#501). Edits are held here and only leave through
 * "Xong"; closing drops them. Past slots on today are disabled, so a start the
 * slot helpers would quietly roll to tomorrow can never be picked while the day
 * says today. "Giờ khác" swaps the body for the 30-minute grid in the same
 * sheet: iOS refuses a second modal opened over this one.
 */
export function DateTimeSheet({ visible, initialDay, initialTime, onClose, onDone }: {
  visible: boolean
  /** `YYYY-MM-DD`, or null for today. */
  initialDay: string | null
  initialTime: string | null
  onClose: () => void
  onDone: (day: string | null, time: string) => void
}) {
  const { t } = useTranslation()
  const locale = i18n.language
  const now = new Date()
  const todayKey = localDayKey(now)
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const weekend = weekendDay(now)

  const [day, setDay] = useState(initialDay ?? todayKey)
  const [time, setTime] = useState<string | null>(initialTime)
  const [view, setView] = useState<{ year: number; month: number }>(() => monthOf(initialDay ?? todayKey))
  const [slots, setSlots] = useState(false)

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
  }

  function shift(delta: number) {
    const next = new Date(view.year, view.month + delta, 1)
    setView({ year: next.getFullYear(), month: next.getMonth() })
  }

  function shortcut(id: string, key: string, label: string, date: Date) {
    const active = day === key
    return (
      <Pressable
        key={label}
        onPress={() => chooseDay(key)}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${dayLabel(date, locale)}`}
        accessibilityState={{ selected: active }}
        testID={`date-sheet-shortcut-${id}`}
        style={[styles.chip, active && styles.chipActive]}
      >
        {active ? <Icon name="check" size={14} color="accent.onSoft" /> : null}
        <Text variant={active ? 'label' : 'bodySmall'} color={active ? 'accent.onSoft' : 'text.primary'} numberOfLines={1}>{label}</Text>
      </Pressable>
    )
  }

  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2026, 10, 2 + i))

  return (
    <Sheet visible={visible} onClose={onClose} maxHeight="92%" testID="date-time-sheet">
      <View style={styles.head}>
        <Text variant="title1" style={styles.headTitle}>{t('createTime.sheetTitle')}</Text>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} testID="date-sheet-close" style={styles.iconBtn}>
          <Icon name="x" size={22} />
        </Pressable>
      </View>

      {slots ? (
        <>
          <Text variant="title2" style={styles.sectionHead}>{t('createTime.pickTime')} · {t('createTime.start')}</Text>
          <View style={styles.slotGrid}>
            {TIME_SLOTS.map(slot => {
              const off = isPastSlot(slot, dayArg, now)
              const active = time === slot
              return (
                <Pressable
                  key={slot}
                  disabled={off}
                  onPress={() => {
                    setTime(slot)
                    setSlots(false)
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled: off }}
                  style={[styles.slotBtn, active && styles.slotBtnActive, off && styles.slotBtnOff]}
                >
                  <Text variant="label" color={active ? 'accent.onAccent' : 'text.primary'}>{slot}</Text>
                </Pressable>
              )
            })}
          </View>
        </>
      ) : (
        <>
          <View style={styles.shortcutRow}>
            {shortcut('today', todayKey, t('createTime.today'), now)}
            {shortcut('tomorrow', localDayKey(tomorrow), t('createTime.tomorrow'), tomorrow)}
            {shortcut('weekend', weekend.key, t('createTime.weekend'), weekend.date)}
          </View>

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
          {monthGrid(view.year, view.month).map((week, w) => (
            <View key={w} style={styles.weekRow}>
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
                      testID={`date-sheet-day-${key}`}
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

          <View style={styles.sectionHead}>
            <Icon name="clock" size={18} />
            <Text variant="title2">{t('createTime.startTimeLabel')}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeRow}>
            {EVENING_STARTS.map(slot => {
              const off = isPastSlot(slot, dayArg, now)
              const active = time === slot
              return (
                <Pressable
                  key={slot}
                  disabled={off}
                  onPress={() => setTime(slot)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled: off }}
                  testID={`date-sheet-time-${slot}`}
                  style={[styles.chip, active && styles.chipActive, off && styles.chipOff]}
                >
                  {active ? <Icon name="check" size={14} color="accent.onSoft" /> : null}
                  <Text variant={active ? 'label' : 'bodySmall'} color={active ? 'accent.onSoft' : 'text.primary'}>{slot}</Text>
                </Pressable>
              )
            })}
            <Pressable
              onPress={() => setSlots(true)}
              accessibilityRole="button"
              accessibilityState={{ selected: time !== null && !(EVENING_STARTS as readonly string[]).includes(time) }}
              testID="date-sheet-other-time"
              style={[styles.chip, time !== null && !(EVENING_STARTS as readonly string[]).includes(time) && styles.chipActive]}
            >
              <Icon name="clock" size={14} color="text.secondary" />
              <Text variant="bodySmall" numberOfLines={1}>{t('createTime.otherTime')}</Text>
            </Pressable>
          </ScrollView>

          <View testID="date-sheet-summary" style={[styles.summary, past && styles.summaryInvalid]}>
            <Icon name="calendar" size={18} color={past ? 'status.dangerText' : 'accent.onSoft'} />
            <Text variant="label" color={past ? 'status.dangerText' : 'accent.onSoft'} style={styles.headTitle}>
              {dayTimeLabel(pickedDay, time ?? t('createTime.notSet'), locale)}
            </Text>
          </View>
          {past ? <Text variant="caption" color="status.dangerText">{t('createTime.startPast')}</Text> : null}
        </>
      )}

      {slots ? null : (
        <PrimaryBtn
          label={t('createTime.done')}
          disabled={!canDone}
          onPress={() => onDone(dayArg, time as string)}
          style={styles.done}
        />
      )}
    </Sheet>
  )
}

function monthOf(key: string): { year: number; month: number } {
  const date = parseDayKey(key) ?? new Date()
  return { year: date.getFullYear(), month: date.getMonth() }
}
