import { createContext, useContext, useRef, type ReactNode, type RefObject } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'

/** A sheet measures the focused field together with its label and helpers. */
export const FocusedFieldGroup = createContext<RefObject<View | null> | null>(null)
export const FieldGroup = createContext<RefObject<View | null> | null>(null)
export function FieldFocusGroup({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const group = useRef<View>(null)
  return <FieldGroup.Provider value={group}><View ref={group} collapsable={false} style={style}>{children}</View></FieldGroup.Provider>
}
export function useFieldFocusGroup() {
  return { groupRef: useContext(FieldGroup), focusedRef: useContext(FocusedFieldGroup) }
}
