import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { TextInput, type TextInputRef } from '@/shared/ui/text-input'
import { styles } from './password-recovery.style'

export function RecoveryCode({ value, onChange, disabled, focusRequest = 0, onFocus, onBlur }: { value: string[]; onChange: (value: string[]) => void; disabled: boolean; focusRequest?: number; onFocus?: () => void; onBlur?: () => void }) {
  const { t } = useTranslation()
  const inputs = useRef<(TextInputRef | null)[]>([])
  const [focused, setFocused] = useState<number | null>(0)
  useEffect(() => {
    if (focusRequest > 0 && !disabled) inputs.current[0]?.focus()
  }, [focusRequest, disabled])
  function change(index: number, text: string) {
    const digits = text.replace(/[^0-9]/g, '').slice(0, 6)
    // Native paste/autofill must receive all six digits before distributing them.
    const start = digits.length === 6 ? 0 : index
    const updated = [...value]
    if (!digits) updated[index] = ''
    else [...digits].forEach((digit, offset) => { if (start + offset < 6) updated[start + offset] = digit })
    onChange(updated)
    if (digits) inputs.current[Math.min(start + digits.length, 5)]?.focus()
  }
  return <View style={styles.digits}>{value.map((digit, index) => <TextInput key={index}
    ref={input => { inputs.current[index] = input }}
    accessibilityLabel={t('auth.recovery.codeDigit', { position: index + 1 })}
    value={digit} editable={!disabled} keyboardType="number-pad" inputMode="numeric"
    autoComplete={index === 0 ? 'one-time-code' : 'off'} textContentType={index === 0 ? 'oneTimeCode' : 'none'}
    autoFocus={index === 0} selectTextOnFocus maxLength={6}
    onChangeText={text => change(index, text)} onFocus={() => { setFocused(index); onFocus?.() }} onBlur={() => { setFocused(null); onBlur?.() }}
    onKeyPress={({ nativeEvent }) => { if (nativeEvent.key === 'Backspace' && !digit && index > 0) inputs.current[index - 1]?.focus() }}
    style={[styles.digit, focused === index && styles.digitFocused]} />)}</View>
}
