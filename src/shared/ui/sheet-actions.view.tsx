import { Children, cloneElement, isValidElement, type ReactNode } from 'react'
import { View } from 'react-native'
import type { ButtonProps } from './button.view'
import { styles } from './sheet-actions.style'

/** Sheet commands in reading order: secondary left, primary right. Options belong in the body. */
export function SheetActions({ children }: { children: ReactNode }) {
  return <View testID="sheet-actions" style={styles.row}>
    {Children.toArray(children).map(child => isValidElement<ButtonProps>(child)
      ? cloneElement(child, { style: [child.props.style, styles.action], wrapLabel: child.props.wrapLabel ?? false })
      : child)}
  </View>
}
