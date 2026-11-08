import { act, fireEvent, render, screen, within } from '@testing-library/react-native'
import { processColor, StyleSheet } from 'react-native'
import { themes, type AppTheme } from '../theme'

// Evaluate the real stylesheet factories in each theme; the stock mock pins
// styles to orange. This checks tokens, not native theme switching.
let currentTheme: AppTheme = themes.orange
const unistyles = jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles')
const runtime = unistyles.useUnistyles().rt
jest.spyOn(unistyles, 'useUnistyles').mockImplementation(() => ({ theme: currentTheme, rt: runtime }))
jest.spyOn(unistyles.StyleSheet, 'create').mockImplementation(factory => new Proxy({} as ReturnType<typeof unistyles.StyleSheet.create>, {
  get: (_target, key) => key === 'useVariants' ? () => {} : Reflect.get(typeof factory === 'function' ? factory(currentTheme, runtime) : factory, key),
}))
const { SecondaryBtn } = jest.requireActual<typeof import('../button.view')>('../button.view')

type HostNode = { props: Record<string, unknown>; children?: (HostNode | string)[] }
function fills(node: HostNode): unknown[] {
  return [node.props.fill, ...(node.children ?? []).flatMap(child => typeof child === 'string' ? [] : fills(child))]
}

describe.each(Object.entries(themes))('%s shared neutral button', (_name, theme) => {
  beforeEach(() => { currentTheme = theme })

  it('uses a borderless neutral surface, label and icon tokens at rest and while pressed', async () => {
    await render(<SecondaryBtn variant="neutral" label="Export" leadingIcon="download" onPress={jest.fn()} />)
    const button = screen.getByRole('button', { name: 'Export' })
    expect(StyleSheet.flatten(button.props.style)).toMatchObject({ backgroundColor: theme.surface.subtle, borderWidth: 0 })
    expect(StyleSheet.flatten(button.props.style).borderColor).toBeUndefined()
    expect(StyleSheet.flatten(screen.getByText('Export').props.style).color).toBe(theme.text.primary)
    const icon = within(button).getByTestId('material-icon-download', { includeHiddenElements: true })
    expect(fills(icon as unknown as HostNode)).toContainEqual({ type: 0, payload: processColor(theme.text.primary) })
    await act(async () => {
      await fireEvent(button, 'responderGrant', {
        nativeEvent: { timestamp: 0, locationX: 0, locationY: 0, pageX: 0, pageY: 0, touches: [], changedTouches: [] },
        persist: () => {}, currentTarget: { measure: () => {} },
      })
    })
    expect(StyleSheet.flatten(button.props.style)).toMatchObject({ backgroundColor: theme.surface.subtle, borderWidth: 0 })
    expect(StyleSheet.flatten(screen.getByText('Export').props.style).color).toBe(theme.text.primary)
  })

  it('keeps the neutral palette even when a caller passes onAccent', async () => {
    await render(<SecondaryBtn variant="neutral" onAccent label="Cancel" leadingIcon="download" onPress={jest.fn()} />)
    const style = StyleSheet.flatten(screen.getByRole('button', { name: 'Cancel' }).props.style)
    expect(style).toMatchObject({ borderWidth: 0, backgroundColor: theme.surface.subtle })
    expect(style.borderColor).toBeUndefined()
    expect(StyleSheet.flatten(screen.getByText('Cancel').props.style).color).toBe(theme.text.primary)
  })

  it('keeps loading neutral and disables duplicate presses; disabled labels and icons use secondary text', async () => {
    const onPress = jest.fn()
    const view = await render(<SecondaryBtn variant="neutral" label="Export" loading disabled onPress={onPress} />)
    const button = () => screen.getByRole('button', { name: 'Export' })
    expect(StyleSheet.flatten(button().props.style)).toMatchObject({ backgroundColor: theme.surface.subtle, borderWidth: 0 })
    expect(StyleSheet.flatten(screen.getByText('Export').props.style).color).toBe(theme.text.primary)
    expect(screen.getByTestId('button-spinner').props.color).toBe(theme.text.primary)
    expect(button().props.accessibilityState).toMatchObject({ busy: true, disabled: true })
    await fireEvent.press(button())
    expect(onPress).not.toHaveBeenCalled()
    await view.rerender(<SecondaryBtn variant="neutral" label="Export" leadingIcon="download" disabled onPress={onPress} />)
    expect(StyleSheet.flatten(button().props.style)).toMatchObject({ backgroundColor: theme.surface.subtle, borderWidth: 0 })
    expect(StyleSheet.flatten(screen.getByText('Export').props.style).color).toBe(theme.text.secondary)
    const icon = within(button()).getByTestId('material-icon-download', { includeHiddenElements: true })
    expect(fills(icon as unknown as HostNode)).toContainEqual({ type: 0, payload: processColor(theme.text.secondary) })
    await fireEvent.press(button())
    expect(onPress).not.toHaveBeenCalled()
  })
})
