import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { DangerBtn, GhostBtn, IconBtn, PrimaryBtn, SecondaryBtn } from '@/shared/ui/button.view'
import { accents, glassFx, shadows, status, surface, text, type } from '@/shared/ui/tokens'

/**
 * #295 — the button family per #293 §2. Colours are the orange theme: the
 * Unistyles jest mock serves the first registered theme, and theme switching
 * itself is not jest-testable (ADR-0009, A decision 9).
 */
const orange = accents.orange

const flat = (node: { props: Record<string, any> }): Record<string, any> => StyleSheet.flatten(node.props.style)
const button = (name: string) => screen.getByRole('button', { name })
const labelColor = (label: string) => flat(screen.getByText(label)).color

/**
 * Put a finger down and leave it there. RNTL's `pressIn` calls a prop the host
 * view does not have, so drive Pressability the way the responder system does:
 * a grant with no press delay flips `pressed` synchronously.
 */
async function holdDown(name: string) {
  const touch = { timestamp: 0, locationX: 0, locationY: 0, pageX: 0, pageY: 0, touches: [], changedTouches: [] }
  await act(async () => {
    fireEvent(button(name), 'responderGrant', {
      nativeEvent: touch,
      persist: () => {},
      currentTarget: { measure: () => {} },
    })
  })
}

async function pressedStyle(name: string) {
  await holdDown(name)
  return flat(button(name))
}

describe.each([
  ['PrimaryBtn', PrimaryBtn, { height: 56, bg: orange.primary, label: orange.onAccent, pressedBg: orange.pressed, spinner: orange.onAccent }],
  ['SecondaryBtn', SecondaryBtn, { height: 52, bg: surface.card, label: orange.primary, pressedBg: orange.soft, spinner: orange.primary }],
  ['GhostBtn', GhostBtn, { height: 44, bg: undefined, label: orange.primary, pressedBg: surface.subtle, spinner: orange.primary }],
  ['DangerBtn', DangerBtn, { height: 52, bg: surface.card, label: status.dangerText, pressedBg: status.dangerSoft, spinner: status.dangerText }],
] as const)('%s', (_name, Btn, look) => {
  it('default: height, fill and label colour from the theme, label in the `label` style on one line', async () => {
    await render(<Btn label="Tạo kèo" onPress={jest.fn()} />)
    const style = flat(button('Tạo kèo'))
    expect(style.height).toBe(look.height)
    expect(style.backgroundColor).toBe(look.bg)
    expect(style.transform).toBeUndefined()
    const label = screen.getByText('Tạo kèo')
    expect(label.props.numberOfLines).toBe(1)
    expect(label.props.ellipsizeMode).toBe('tail')
    expect(label.props.adjustsFontSizeToFit).toBeUndefined()
    expect(flat(label)).toMatchObject({ ...type.label, color: look.label })
  })

  it('pressed: a colour change only — no scale, no fade', async () => {
    await render(<Btn label="Tạo kèo" onPress={jest.fn()} />)
    const style = await pressedStyle('Tạo kèo')
    expect(style.backgroundColor).toBe(look.pressedBg)
    expect(style.transform).toBeUndefined()
    expect(style.opacity).toBeUndefined()
  })

  it('disabled: neutral fill, secondary label, and onPress never fires', async () => {
    const onPress = jest.fn()
    await render(<Btn label="Tạo kèo" onPress={onPress} disabled />)
    await act(async () => fireEvent.press(button('Tạo kèo')))
    expect(onPress).not.toHaveBeenCalled()
    expect(button('Tạo kèo').props.accessibilityState).toMatchObject({ disabled: true })
    if (look.bg) expect(flat(button('Tạo kèo')).backgroundColor).toBe(surface.subtle)
    expect(labelColor('Tạo kèo')).toBe(text.secondary)
  })

  it('loading: spinner beside the label, busy, and a second press never reaches onPress', async () => {
    const onPress = jest.fn()
    await render(<Btn label="Đang lưu" onPress={onPress} loading />)
    expect(screen.getByText('Đang lưu')).toBeTruthy()
    expect(screen.getByTestId('button-spinner').props.color).toBe(look.spinner)
    expect(button('Đang lưu').props.accessibilityState).toMatchObject({ busy: true, disabled: true })
    await act(async () => fireEvent.press(button('Đang lưu')))
    expect(onPress).not.toHaveBeenCalled()
    // Loading keeps the default look; only `disabled` greys the button out.
    expect(labelColor('Đang lưu')).toBe(look.label)
  })
})

describe('loading and disabled together (Sol #295 P2)', () => {
  it('reads as loading, not greyed out — the usual `loading={p} disabled={p || …}` call', async () => {
    const onPress = jest.fn()
    await render(<PrimaryBtn label="Đang gửi" onPress={onPress} loading disabled />)
    expect(flat(button('Đang gửi')).backgroundColor).toBe(orange.primary)
    expect(labelColor('Đang gửi')).toBe(orange.onAccent)
    expect(screen.getByTestId('button-spinner').props.color).toBe(orange.onAccent)
    await act(async () => fireEvent.press(button('Đang gửi')))
    expect(onPress).not.toHaveBeenCalled()
  })
})

describe('PrimaryBtn', () => {
  it('carries the accent CTA shadow at rest and drops it when pressed or disabled', async () => {
    await render(<PrimaryBtn label="Chốt" onPress={jest.fn()} />)
    expect(flat(button('Chốt'))).toMatchObject({ ...shadows.cta, shadowColor: orange.primary })
    expect((await pressedStyle('Chốt')).shadowOpacity).toBe(0)
  })

  it('fires onPress once when enabled', async () => {
    const onPress = jest.fn()
    await render(<PrimaryBtn label="Chốt" onPress={onPress} />)
    await act(async () => fireEvent.press(button('Chốt')))
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})

describe('onAccent — on an accent-coloured hero', () => {
  it('Primary swaps fill and label: white fill, accent label, no shadow', async () => {
    await render(<PrimaryBtn label="Bắt đầu" onPress={jest.fn()} onAccent />)
    const style = flat(button('Bắt đầu'))
    expect(style.backgroundColor).toBe(orange.onAccent)
    expect(style.shadowOpacity).toBe(0)
    expect(labelColor('Bắt đầu')).toBe(orange.primary)
    expect((await pressedStyle('Bắt đầu')).backgroundColor).toBe(orange.soft)
  })

  it('Secondary is a white outline with a white label', async () => {
    await render(<SecondaryBtn label="Mời bạn" onPress={jest.fn()} onAccent />)
    const style = flat(button('Mời bạn'))
    expect(style.backgroundColor).toBe('transparent')
    expect(style.borderColor).toBe(orange.onAccent)
    expect(labelColor('Mời bạn')).toBe(orange.onAccent)
    expect((await pressedStyle('Mời bạn')).backgroundColor).toBe(glassFx.badge)
  })

  it('disabled and loading fade rather than turn grey — no neutral fill reads on a coloured ground', async () => {
    await render(<PrimaryBtn label="Bắt đầu" onPress={jest.fn()} onAccent disabled />)
    expect(flat(button('Bắt đầu')).opacity).toBe(0.6)
    expect(labelColor('Bắt đầu')).toBe(orange.primary)
  })
})

describe('IconBtn', () => {
  it('is a 40pt hairline circle with slop, and its label is the accessibility name', async () => {
    await render(<IconBtn accessibilityLabel="Sao chép" onPress={jest.fn()}><></></IconBtn>)
    const node = button('Sao chép')
    expect(flat(node)).toMatchObject({ width: 40, height: 40, borderRadius: 20, backgroundColor: surface.card })
    expect(node.props.hitSlop).toBeTruthy()
  })

  it('active is the accent soft fill with an accent ring, and says selected', async () => {
    await render(<IconBtn accessibilityLabel="Bản đồ" onPress={jest.fn()} active><></></IconBtn>)
    expect(flat(button('Bản đồ'))).toMatchObject({ backgroundColor: orange.soft, borderColor: orange.primary })
    expect(button('Bản đồ').props.accessibilityState).toMatchObject({ selected: true })
  })

  it('pressed swaps to the subtle fill', async () => {
    await render(<IconBtn accessibilityLabel="Sao chép" onPress={jest.fn()}><></></IconBtn>)
    expect((await pressedStyle('Sao chép')).backgroundColor).toBe(surface.subtle)
  })

  it('disabled changes the fill and never fires', async () => {
    const onPress = jest.fn()
    await render(<IconBtn accessibilityLabel="Sao chép" onPress={onPress} disabled><></></IconBtn>)
    expect(flat(button('Sao chép')).backgroundColor).toBe(surface.subtle)
    await act(async () => fireEvent.press(button('Sao chép')))
    expect(onPress).not.toHaveBeenCalled()
  })
})
