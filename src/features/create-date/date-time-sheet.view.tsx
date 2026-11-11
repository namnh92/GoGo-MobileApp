import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'
import { Icon } from '@/shared/ui/icons'
import { MaterialIcon } from '@/shared/ui/material-icon'
import { Text } from '@/shared/ui/text'
import { monthLabel, weekdayShort } from './day-format'
import { monthGrid, parseDayKey } from './calendar'
import { localDayKey } from './schedule-day'
import { styles } from './date-time-sheet.style'

/** Inline calendar; time is selected separately through the start row's wheel. */
export function DateTimeSheet({ initialDay, onDayChange }: {
  initialDay: string | null
  onDayChange: (day: string | null) => void
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const now = new Date()
  const todayKey = localDayKey(now)
  const day = initialDay ?? todayKey
  const pickedDay = parseDayKey(day) ?? now
  const [view, setView] = useState(() => monthOf(day))
  const [expanded, setExpanded] = useState(false)
  const onCurrentMonth = view.year === now.getFullYear() && view.month === now.getMonth()
  function chooseDay(key: string) {
    setView(monthOf(key))
    onDayChange(key === todayKey ? null : key)
  }
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
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2026, 10, 2 + i))
  return <View testID="date-time-inline">
    <View style={styles.calendar}>
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
        <View key={w} testID="date-inline-week" style={styles.weekRow}>
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
                  testID={`date-inline-day-${key}`}
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
        testID="date-inline-expand" style={styles.expand} onPress={() => setExpanded(value => !value)}>
        <MaterialIcon name={expanded ? 'keyboardDoubleArrowUp' : 'keyboardDoubleArrowDown'} color="accent.primary" />
      </Pressable>
    </View>
  </View>
}

function monthOf(key: string): { year: number; month: number } {
  const date = parseDayKey(key) ?? new Date()
  return { year: date.getFullYear(), month: date.getMonth() }
}
