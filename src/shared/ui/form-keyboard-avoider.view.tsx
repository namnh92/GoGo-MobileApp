import { KeyboardAvoidingView, Platform, type KeyboardAvoidingViewProps } from 'react-native'

import { syncAndroidKeyboardVisibility, useKeyboardVisible } from './keyboard'

export type FormKeyboardAvoiderProps = Omit<KeyboardAvoidingViewProps, 'behavior' | 'enabled'>

/** Edge-to-edge Android does not resize the form for the IME. Disable padding
 * once hidden so RN's retained hide coordinates cannot leave a bottom gap. */
export function FormKeyboardAvoider({ onLayout, ...props }: FormKeyboardAvoiderProps) {
  const keyboardVisible = useKeyboardVisible()
  return <KeyboardAvoidingView {...props} behavior={Platform.OS === 'ios' || Platform.OS === 'android' ? 'padding' : undefined}
    enabled={Platform.OS !== 'android' || keyboardVisible}
    onLayout={event => {
      // The shared hook also resyncs on AppState active (including missed hide).
      syncAndroidKeyboardVisibility()
      onLayout?.(event)
    }} />
}
