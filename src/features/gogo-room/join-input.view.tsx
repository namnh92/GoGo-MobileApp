import type { ReactNode } from 'react'
import { View, type TextInputProps } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { TextInput } from '@/shared/ui/text-input'
import { styles } from './join-input.style'

/** One field surface for invite codes and guest names, with an optional action. */
export function JoinInput({ trailing, fieldTestID, ...input }: Omit<TextInputProps, 'style'> & { trailing?: ReactNode; fieldTestID: string }) {
  const { theme } = useUnistyles()
  return <View testID={fieldTestID} style={styles.shell}>
    <TextInput {...input} placeholderTextColor={theme.text.secondary} style={styles.input} />
    {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
  </View>
}
