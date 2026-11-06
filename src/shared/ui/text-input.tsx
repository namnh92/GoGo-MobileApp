import type { Ref } from 'react'
import { TextInput as NativeTextInput, type TextInputProps } from 'react-native'

/** App-owned inputs keep the design font size, including explicit caller opt-ins. */
export function TextInput({ ref, ...props }: TextInputProps & { ref?: Ref<NativeTextInput> }) {
  return <NativeTextInput ref={ref} {...props} allowFontScaling={false} />
}

// Keep native focus queries and ref types available to sheets and form owners.
TextInput.State = NativeTextInput.State
export type TextInputRef = NativeTextInput
