import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { FlatList, Pressable, View } from 'react-native'
import { localeContent } from '@/shared/i18n'
import { Icon } from '@/shared/ui/icons'
import { PrimaryBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { Sheet } from '@/shared/ui/sheet.view'
import { Text } from '@/shared/ui/text'
import { checkTypedDateOfBirth, isoToTyped, parseIsoDate, todayInVietnam, toIsoDate, type CalendarDate } from './date-of-birth'
import { BIRTHDAY_ROW_HEIGHT, styles } from './birthday-sheet.style'

/** Calendar arithmetic only: never parse a birthday as a device-local instant. */
export function daysInBirthdayMonth(year: number, month: number) {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

function Wheel({ label, part, value, max, onChange }: {
  label: string; part: keyof CalendarDate; value: number; max: number; onChange: (value: number) => void
}) {
  const list = useRef<FlatList<number>>(null)
  const fromScroll = useRef<number | null>(null)
  const values = useMemo(() => Array.from({ length: max }, (_, index) => index + 1), [max])
  const display = (number: number) => String(number).padStart(part === 'year' ? 4 : 2, '0')
  useEffect(() => {
    // Let the native wheel finish its gesture; only external changes reposition it.
    if (fromScroll.current !== value) list.current?.scrollToOffset({ offset: (value - 1) * BIRTHDAY_ROW_HEIGHT, animated: false })
    fromScroll.current = null
  }, [value, max])
  const selectOffset = (offset: number) => {
    const next = Math.max(1, Math.min(max, Math.round(offset / BIRTHDAY_ROW_HEIGHT) + 1))
    if (next === value) return
    fromScroll.current = next
    onChange(next)
  }
  return <View style={styles.column}>
    <Text variant="avatarCaption" color="text.secondary" style={styles.columnLabel}>{label.toLocaleUpperCase()}</Text>
    <View accessible accessibilityRole="adjustable" accessibilityLabel={label}
      accessibilityValue={{ min: 1, max, now: value, text: display(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={({ nativeEvent }) => {
        if (nativeEvent.actionName === 'increment') onChange(Math.min(max, value + 1))
        if (nativeEvent.actionName === 'decrement') onChange(Math.max(1, value - 1))
      }} style={styles.wheel}>
      <FlatList ref={list} testID={`birthday-wheel-${part}`} data={values} keyExtractor={item => String(item)}
        accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        initialScrollIndex={value - 1} initialNumToRender={5} windowSize={3}
        getItemLayout={(_, index) => ({ length: BIRTHDAY_ROW_HEIGHT, offset: index * BIRTHDAY_ROW_HEIGHT, index })}
        contentContainerStyle={styles.wheelPadding} showsVerticalScrollIndicator={false}
        snapToInterval={BIRTHDAY_ROW_HEIGHT} decelerationRate="fast" bounces={false}
        scrollEventThrottle={16}
        onScroll={event => selectOffset(event.nativeEvent.contentOffset.y)}
        onMomentumScrollEnd={event => selectOffset(event.nativeEvent.contentOffset.y)}
        onScrollEndDrag={event => {
          // A drag with no momentum still needs to commit its snapped row.
          if (event.nativeEvent.velocity?.y === 0) selectOffset(event.nativeEvent.contentOffset.y)
        }}
        renderItem={({ item }) => <Pressable accessible={false} accessibilityRole="button" accessibilityLabel={display(item)} onPress={() => onChange(item)} style={[styles.row, item === value && styles.selected]}>
          <Text variant={item === value ? 'introHeading' : 'introSmall'} color={item === value ? 'text.primary' : 'text.secondary'}>{display(item)}</Text>
        </Pressable>} />
    </View>
  </View>
}

export function BirthdaySheet({ visible, date, onChange, onClose, onConfirm }: {
  visible: boolean; date: CalendarDate; onChange: (date: CalendarDate) => void; onClose: () => void; onConfirm: (value: string) => void
}) {
  const { t, i18n } = useTranslation()
  const today = parseIsoDate(todayInVietnam())!
  const typed = isoToTyped(toIsoDate(date))
  const check = checkTypedDateOfBirth(typed)
  function change(part: keyof CalendarDate, value: number) {
    const next = { ...date, [part]: value }
    next.day = Math.min(next.day, daysInBirthdayMonth(next.year, next.month))
    onChange(next)
  }
  function shiftYears(amount: number) {
    const next = { ...date, year: Math.max(1, Math.min(today.year, date.year + amount)) }
    next.day = Math.min(next.day, daysInBirthdayMonth(next.year, next.month))
    onChange(toIsoDate(next) > toIsoDate(today) ? today : next)
  }
  return <Sheet visible={visible} onClose={onClose} scroll={false} maxHeight="100%" appearance="avatar" testID="birthday-sheet">
    <View style={styles.content} accessibilityViewIsModal>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text variant="introHeading" accessibilityRole="header">{t('account.birthdayPickerTitle')}</Text>
          <Text variant="avatarSubtitle" color="text.secondary">{t('account.birthdayPickerPrivacy')}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
          <Icon name="x" size={20} color="text.secondary" />
        </Pressable>
      </View>
      <View style={styles.summary}>
        <Text variant="avatarSubtitle" color="text.secondary">{t('account.birthdaySelected')}</Text>
        <Text variant="savedWardTitle" color="accent.primary" accessibilityLiveRegion="polite">{t('account.birthdaySummary', { day: date.day, month: String(date.month).padStart(2, '0'), monthName: localeContent(i18n.language).monthNames[date.month - 1], year: date.year })}</Text>
      </View>
      <View style={styles.picker}>
        <View style={styles.columns}>
          <Wheel part="day" label={t('account.birthdayDay')} value={date.day} max={daysInBirthdayMonth(date.year, date.month)} onChange={value => change('day', value)} />
          <Wheel part="month" label={t('account.birthdayMonth')} value={date.month} max={12} onChange={value => change('month', value)} />
          <Wheel part="year" label={t('account.birthdayYear')} value={date.year} max={today.year} onChange={value => change('year', value)} />
        </View>
        <View style={styles.shortcuts}>
          {([
            [t('account.birthdayMinusTen'), () => shiftYears(-10)],
            [t('account.birthdayToday'), () => onChange(today)],
            [t('account.birthdayPlusTen'), () => shiftYears(10)],
          ] as const).map(([label, onPress]) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}>
            <Text variant="avatarTool" color="text.secondary">{label}</Text>
          </Pressable>)}
        </View>
      </View>
      {!check.ok ? <Text variant="bodySmall" color="status.dangerText" accessibilityRole="alert" accessibilityLiveRegion="polite">{t(check.reason === 'future' ? 'account.dobFuture' : 'account.dobInvalid')}</Text> : null}
      <View style={styles.actions}>
        <SecondaryBtn variant="stitch" label={t('common.cancel')} onPress={onClose} style={styles.action} />
        <PrimaryBtn variant="stitch" label={t('areaPicker.confirm')} disabled={!check.ok} onPress={() => { if (checkTypedDateOfBirth(typed).ok) onConfirm(typed) }} style={styles.action} />
      </View>
    </View>
  </Sheet>
}
