import { View } from 'react-native'
import { Text } from '@/shared/ui/text'
import { styles } from './wizard-step-header.style'

/** Shared title, subtitle and first-control gap for wizard steps. */
export function WizardStepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return <View testID="wizard-step-header" style={styles.header}>
    <Text testID="wizard-step-title" variant="display">{title}</Text>
    <Text testID="wizard-step-subtitle" color="text.secondary" style={styles.subtitle}>{subtitle}</Text>
  </View>
}
