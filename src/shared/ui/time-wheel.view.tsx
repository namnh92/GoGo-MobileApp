import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { Text } from './text'
import { styles, WHEEL_ROW } from './time-wheel.style'

const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'))

function WheelColumn({ values, value, label, onChange, testID }: {
  values: string[]; value: string; label: string; onChange: (value: string) => void; testID: string
}) {
  const ref = useRef<ScrollView>(null)
  const index = Math.max(0, values.indexOf(value))
  const [initialOffset] = useState(() => ({ x: 0, y: index * WHEEL_ROW }))
  function pick(next: number) {
    const bounded = Math.max(0, Math.min(values.length - 1, next))
    ref.current?.scrollTo({ y: bounded * WHEEL_ROW, animated: false })
    onChange(values[bounded])
  }
  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    onChange(values[Math.max(0, Math.min(values.length - 1, Math.round(event.nativeEvent.contentOffset.y / WHEEL_ROW)))])
  }
  return <View style={styles.column}>
    <Text variant="label" color="text.secondary" style={styles.label}>{label}</Text>
    <View style={styles.window}>
      <View pointerEvents="none" style={styles.selection} />
      <ScrollView ref={ref} testID={testID} accessible accessibilityRole="adjustable" accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: values.length - 1, now: index, text: value }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={event => pick(index + (event.nativeEvent.actionName === 'increment' ? 1 : -1))}
        contentOffset={initialOffset}
        contentContainerStyle={styles.content} snapToInterval={WHEEL_ROW} decelerationRate="fast"
        showsVerticalScrollIndicator={false} nestedScrollEnabled
        onMomentumScrollEnd={settle} onScrollEndDrag={settle}>
        {values.map((option, optionIndex) => <Pressable key={option} testID={`${testID}-${option}`}
          accessibilityRole="button" accessibilityLabel={`${label} ${option}`} accessibilityState={{ selected: value === option }}
          style={styles.item} onPress={() => pick(optionIndex)}>
          <Text variant={value === option ? 'discoveryHeading' : 'introHeading'} color={value === option ? 'accent.onSoft' : 'text.secondary'}>{option}</Text>
        </Pressable>)}
      </ScrollView>
    </View>
  </View>
}

/** Native scroll snapping, with independent hour/minute columns and adjustable a11y controls. */
export function TimeWheel({ value, onChange, testID = 'time-wheel' }: { value: string; onChange: (value: string) => void; testID?: string }) {
  const { t } = useTranslation()
  const [hours, minutes] = value.split(':')
  return <View testID={testID} style={styles.row}>
    <WheelColumn values={HOURS} value={hours} label={t('createTime.hours')} onChange={hour => onChange(`${hour}:${minutes}`)} testID={`${testID}-hours`} />
    <WheelColumn values={MINUTES} value={minutes} label={t('createTime.minutes')} onChange={minute => onChange(`${hours}:${minute}`)} testID={`${testID}-minutes`} />
  </View>
}
