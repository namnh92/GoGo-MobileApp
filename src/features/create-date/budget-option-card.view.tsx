import { Pressable, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { Icon, IconCheck } from '@/shared/ui/icons'
import { glassStyles } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { styles } from './budget-option-card.style'

/** The option card from 825f5224, also used as the edit form's summary. */
export function BudgetOptionCard({ title, description, selected = false, disabled = false, onPress, testID, summary = false, hint }: {
  title: string
  description: string
  selected?: boolean
  disabled?: boolean
  onPress: () => void
  testID: string
  summary?: boolean
  hint?: string
}) {
  const { theme } = useUnistyles()
  return <Pressable testID={testID} onPress={onPress} disabled={disabled}
    accessibilityRole={summary ? 'button' : 'radio'} accessibilityLabel={title} accessibilityHint={hint ?? description}
    accessibilityState={summary ? { disabled } : { selected, checked: selected, disabled }}
    style={[styles.option, selected ? styles.optionActive : glassStyles.card, disabled && styles.disabled]}>
    <View style={styles.optionBody}>
      <Text variant="discoveryHeading" color={selected ? 'accent.onSoft' : 'text.primary'}>{title}</Text>
      <Text variant="bodySmall" color="text.secondary" style={styles.optionSub}>{description}</Text>
    </View>
    {summary ? <Icon name="chevronRight" size={20} /> : <View testID={`${testID}-radio`} style={[styles.checkBubble, selected && styles.checkBubbleActive]}>
      {selected ? <IconCheck color={theme.accent.onAccent} size={12} /> : null}
    </View>}
  </Pressable>
}
