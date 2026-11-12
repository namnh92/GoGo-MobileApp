import type { ReactNode } from 'react'
import { Text } from './text'
import { styles } from './section-label.style'

/** One presentation for in-step section headings across create and edit. */
export function SectionLabel({ children, testID }: { children: ReactNode; testID?: string }) {
  return <Text testID={testID} variant="label" accessibilityRole="header" style={styles.label}>{children}</Text>
}
