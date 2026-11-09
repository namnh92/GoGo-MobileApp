import { render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { themes, type AppTheme } from '../theme'
import { buttonSizes, touchTarget, type, type ButtonSize } from '../tokens'
import type { ButtonProps } from '../button.view'

// Run the real stylesheet factories against Light and Dark token palettes.
let currentTheme: AppTheme = themes.orange
const unistyles = jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles')
const runtime = unistyles.useUnistyles().rt
jest.spyOn(unistyles, 'useUnistyles').mockImplementation(() => ({ theme: currentTheme, rt: runtime }))
jest.spyOn(unistyles.StyleSheet, 'create').mockImplementation(factory => new Proxy({} as ReturnType<typeof unistyles.StyleSheet.create>, {
  get: (_target, key) => key === 'useVariants' ? () => {} : Reflect.get(typeof factory === 'function' ? factory(currentTheme, runtime) : factory, key),
}))
const { PrimaryBtn, SecondaryBtn, GhostBtn, DangerBtn, IconBtn } = jest.requireActual<typeof import('../button.view')>('../button.view')
const variants: NonNullable<ButtonProps['variant']>[] = ['default', 'pill', 'neutral', 'neutralPill', 'stitch', 'stitchSubtle', 'stitchGuest', 'stitchSkip', 'stitchSkipPill', 'discovery', 'discoveryJoin', 'area']
const sizes = Object.keys(buttonSizes) as ButtonSize[]

it('pins the owner-approved regular and small heights', () => {
  expect(buttonSizes.regular.minHeight).toBe(48)
  expect(buttonSizes.small.minHeight).toBe(40)
})

describe.each(Object.entries(themes))('%s button sizes', (_name, theme) => {
  beforeEach(() => { currentTheme = theme })

  it.each(sizes)('%s sizing is independent of kind, visual variant and loading/disabled state', async size => {
    const token = buttonSizes[size]
    const view = await render(<></>)
    for (const Btn of [PrimaryBtn, SecondaryBtn, GhostBtn, DangerBtn]) {
      for (const variant of variants) {
        for (const state of [{}, { loading: true }, { disabled: true }]) {
          await view.rerender(<Btn size={size} variant={variant} label="Continue" leadingIcon="check" onPress={jest.fn()} {...state} />)
          const button = screen.getByRole('button', { name: 'Continue' })
          const style = StyleSheet.flatten(button.props.style)
          expect(style).toMatchObject({ minHeight: token.minHeight, paddingHorizontal: token.paddingHorizontal, paddingVertical: token.paddingVertical })
          expect(style.height).toBeUndefined()
          expect(StyleSheet.flatten(screen.getByText('Continue').props.style)).toMatchObject(type[token.label])
          // Content plus padding and outline must fit the promised single-line height.
          expect(Math.max(type[token.label].lineHeight, token.iconSize, 20) + 2 * (token.paddingVertical + (style.borderWidth ?? 0))).toBeLessThanOrEqual(token.minHeight)
          expect(style.minHeight + button.props.hitSlop.top + button.props.hitSlop.bottom).toBeGreaterThanOrEqual(touchTarget.min)
          expect(style.minWidth + button.props.hitSlop.left + button.props.hitSlop.right).toBeGreaterThanOrEqual(touchTarget.min)
        }
      }
    }
  })

  it.each(sizes)('%s icon controls have token dimensions and accessible touch targets', async size => {
    await render(<IconBtn size={size} accessibilityLabel="Back" onPress={jest.fn()}><></></IconBtn>)
    const button = screen.getByRole('button', { name: 'Back' })
    const style = StyleSheet.flatten(button.props.style)
    expect(style).toMatchObject({ height: buttonSizes[size].minHeight, width: buttonSizes[size].minHeight })
    expect(style.height + button.props.hitSlop.top + button.props.hitSlop.bottom).toBeGreaterThanOrEqual(touchTarget.min)
    expect(style.width + button.props.hitSlop.left + button.props.hitSlop.right).toBeGreaterThanOrEqual(touchTarget.min)
  })
})
