import { StyleSheet } from 'react-native'

import { styles as accountStyles } from '@/features/account/account.style'
import { styles as dobStyles } from '@/features/account/date-of-birth.style'
import { styles as joinStyles } from '@/features/gogo-room/join-input.style'
import { styles as signInStyles } from '@/shared/ui/labelled-input.style'

/**
 * A single-line field with a line height and only a minHeight wraps a long
 * value (an email broken at its hyphen) on iOS. These fields carry a fixed
 * height and no line height, so the value stays on one line.
 */
describe('single-line text inputs', () => {
  it.each([
    ['join by code', joinStyles.input],
    ['date of birth', dobStyles.input],
    ['account', accountStyles.input],
  ])('%s: fixed height, no line height', (_name, style) => {
    const flat = StyleSheet.flatten(style as never) as { height?: number; minHeight?: number; lineHeight?: number }
    expect(flat.height).toBeGreaterThanOrEqual(44)
    expect(flat.minHeight).toBeUndefined()
    expect(flat.lineHeight).toBeUndefined()
  })
})

it('auth single-line input grows with native text instead of clipping at 48 points', () => {
  const flat = StyleSheet.flatten(signInStyles.input) as { height?: number; minHeight?: number; lineHeight?: number }
  expect(flat.height).toBeUndefined()
  expect(flat.minHeight).toBe(48)
  expect(flat.lineHeight).toBeUndefined()
})
