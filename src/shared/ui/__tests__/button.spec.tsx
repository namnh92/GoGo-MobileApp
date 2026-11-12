import { themes } from '@/shared/ui/theme'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { type ButtonProps, DangerBtn, GhostBtn, IconBtn, PrimaryBtn, SecondaryBtn } from '@/shared/ui/button.view'
import { accents, buttonSizes, shadows, status, surface, text, type } from '@/shared/ui/tokens'
import * as feedback from '@/shared/ui/feedback'

/**
 * #295 — the button family per #293 §2. Colours are the orange theme: the
 * Unistyles jest mock serves the first registered theme, and theme switching
 * itself is not jest-testable (ADR-0009, A decision 9).
 */
const orange = accents.orange

const flat = (node: { props: Record<string, any> }): Record<string, any> => StyleSheet.flatten(node.props.style)
const button = (name: string) => screen.getByRole('button', { name })
const labelColor = (label: string) => flat(screen.getByText(label)).color

describe.each([PrimaryBtn, SecondaryBtn, GhostBtn, DangerBtn])('wrapped action labels', Btn => {
  it('opts default buttons into wrapping without changing their typography', async () => {
    await render(<Btn label="View all contributions" wrapLabel onPress={jest.fn()} />)
    expect(screen.getByText('View all contributions').props.numberOfLines).toBeUndefined()
    expect(flat(screen.getByText('View all contributions'))).toMatchObject(type.buttonLabel)
  })
})

describe.each([false, true])('area buttons with wrapLabel=%s', wrapLabel => {
  it('preserves area typography, colors, wrapping and disabled state', async () => {
    const onPress = jest.fn()
    const view = await render(<>
      <PrimaryBtn variant="area" label="Confirm area" wrapLabel={wrapLabel} onPress={onPress} />
      <SecondaryBtn variant="area" label="Clear area" wrapLabel={wrapLabel} onPress={onPress} />
    </>)
    for (const label of ['Confirm area', 'Clear area']) {
      expect(screen.getByText(label).props.numberOfLines).toBe(wrapLabel ? undefined : 1)
      expect(flat(screen.getByText(label))).toMatchObject(type.buttonLabel)
    }
    expect(flat(button('Confirm area')).backgroundColor).toBe(themes.orange.accent.primary)
    expect(labelColor('Clear area')).toBe(themes.orange.text.secondary)
    await view.rerender(<PrimaryBtn variant="area" label="Confirm area" wrapLabel={wrapLabel} disabled onPress={onPress} />)
    expect(flat(button('Confirm area')).backgroundColor).toBe(surface.subtle)
    expect(labelColor('Confirm area')).toBe(text.secondary)
    await fireEvent.press(button('Confirm area'))
    expect(onPress).not.toHaveBeenCalled()
  })
})

describe('owner D1 Stitch buttons', () => {
  it('gives discovery primary and secondary CTAs the same size and typography with one filled action', async () => {
    await render(<>
      <PrimaryBtn variant="discovery" label="Reset search" leadingIcon="tune" onPress={jest.fn()} />
      <SecondaryBtn variant="discovery" label="Ask GoGo AI" leadingIcon="sparkle" onPress={jest.fn()} />
    </>)
    for (const name of ['Reset search', 'Ask GoGo AI']) {
      expect(flat(button(name))).toMatchObject({
        minHeight: buttonSizes.regular.minHeight, borderRadius: 999,
        paddingVertical: 12, paddingHorizontal: 16, gap: 4, borderWidth: 1,
      })
      expect(flat(screen.getByText(name))).toMatchObject(type.buttonLabel)
    }
    expect(flat(button('Reset search')).backgroundColor).toBe(orange.primary)
    expect(flat(button('Ask GoGo AI'))).toMatchObject({ backgroundColor: surface.card, borderColor: orange.primary })
  })
  it('uses the drawn 48px CTA with a scaled label and press scale', async () => {
    await render(<PrimaryBtn variant="stitch" label="Tiếp theo" icon="arrowRight" onPress={jest.fn()} />)
    expect(flat(button('Tiếp theo'))).toMatchObject({ minHeight: 48, borderRadius: 12 })
    expect(flat(screen.getByText('Tiếp theo'))).toMatchObject(type.buttonLabel)
    expect((await pressedStyle('Tiếp theo')).transform).toEqual([{ scale: 0.98 }])
  })
  it('keeps the resting fill under reduced motion', async () => {
    const reduced = jest.spyOn(feedback, 'useReducedMotion').mockReturnValue(true)
    try {
      await render(<PrimaryBtn variant="stitchSubtle" label="Đăng nhập" onPress={jest.fn()} />)
      const style = await pressedStyle('Đăng nhập')
      expect(style.transform).toBeUndefined()
      expect(style.backgroundColor).toBe(orange.primary)
    } finally {
      reduced.mockRestore()
    }
  })
})

/**
 * Put a finger down and leave it there. RNTL's `pressIn` calls a prop the host
 * view does not have, so drive Pressability the way the responder system does:
 * a grant with no press delay flips `pressed` synchronously.
 */
async function holdDown(name: string) {
  const touch = { timestamp: 0, locationX: 0, locationY: 0, pageX: 0, pageY: 0, touches: [], changedTouches: [] }
  await act(async () => {
    await fireEvent(button(name), 'responderGrant', {
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

const variants: NonNullable<ButtonProps['variant']>[] = [
  'default', 'pill', 'neutral', 'stitch', 'stitchSubtle', 'stitchGuest',
  'stitchSkip', 'stitchSkipPill', 'discovery', 'discoveryJoin', 'area',
]

describe.each([PrimaryBtn, SecondaryBtn, GhostBtn, DangerBtn])('pressed palette across shared variants', Btn => {
  it.each(variants)('%s keeps its resting fill, border and label', async variant => {
    await render(<Btn variant={variant} label="Action" onPress={jest.fn()} />)
    const resting = flat(button('Action'))
    const restingLabel = labelColor('Action')
    const pressed = await pressedStyle('Action')
    expect(pressed.backgroundColor).toBe(resting.backgroundColor)
    expect(pressed.borderColor).toBe(resting.borderColor)
    expect(labelColor('Action')).toBe(restingLabel)
  })
})

it('keeps a header text action transparent while pressed', async () => {
  await render(<GhostBtn size="small" label="Edit" onPress={jest.fn()} />)
  expect((await pressedStyle('Edit')).backgroundColor).toBeUndefined()
  expect(labelColor('Edit')).toBe(orange.text)
})

describe.each([
  ['PrimaryBtn', PrimaryBtn, { bg: orange.primary, label: orange.onAccent, spinner: orange.onAccent }],
  ['SecondaryBtn', SecondaryBtn, { bg: surface.card, label: orange.text, spinner: orange.primary }],
  ['GhostBtn', GhostBtn, { bg: undefined, label: orange.text, spinner: orange.primary }],
  ['DangerBtn', DangerBtn, { bg: status.dangerSoft, label: status.dangerText, spinner: status.dangerText }],
] as const)('%s', (_name, Btn, look) => {
  it('default: height, fill and label colour from the theme, label in the `label` style on one line', async () => {
    await render(<Btn label="Tạo kèo" onPress={jest.fn()} />)
    const style = flat(button('Tạo kèo'))
    expect(style.minHeight).toBe(buttonSizes.regular.minHeight)
    expect(style.height).toBeUndefined()
    expect(style.backgroundColor).toBe(look.bg)
    expect(style.transform).toBeUndefined()
    const label = screen.getByText('Tạo kèo')
    expect(label.props.numberOfLines).toBe(1)
    expect(label.props.ellipsizeMode).toBe('tail')
    expect(label.props.adjustsFontSizeToFit).toBeUndefined()
    expect(flat(label)).toMatchObject({ ...type.buttonLabel, color: look.label })
  })

  it('pressed: keeps the resting fill and label — no scale, no fade', async () => {
    await render(<Btn label="Tạo kèo" onPress={jest.fn()} />)
    const style = await pressedStyle('Tạo kèo')
    expect(style.backgroundColor).toBe(look.bg)
    expect(labelColor('Tạo kèo')).toBe(look.label)
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
    expect(screen.getByTestId('button-spinner-beam', { includeHiddenElements: true })).toBeTruthy()
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
    expect(screen.getByTestId('button-spinner-beam', { includeHiddenElements: true })).toBeTruthy()
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
    expect(labelColor('Bắt đầu')).toBe(orange.text)
    expect((await pressedStyle('Bắt đầu')).backgroundColor).toBe(orange.onAccent)
  })

  it('Secondary is a white outline with a white label', async () => {
    await render(<SecondaryBtn label="Mời bạn" onPress={jest.fn()} onAccent />)
    const style = flat(button('Mời bạn'))
    expect(style.backgroundColor).toBe('transparent')
    expect(style.borderColor).toBe(orange.onAccent)
    expect(labelColor('Mời bạn')).toBe(orange.onAccent)
    expect((await pressedStyle('Mời bạn')).backgroundColor).toBe('transparent')
  })

  it('disabled and loading fade rather than turn grey — no neutral fill reads on a coloured ground', async () => {
    await render(<PrimaryBtn label="Bắt đầu" onPress={jest.fn()} onAccent disabled />)
    expect(flat(button('Bắt đầu')).opacity).toBe(0.6)
    expect(labelColor('Bắt đầu')).toBe(orange.text)
  })
})

describe('IconBtn', () => {
  it.each([false, true])('plain keeps an unframed 44pt action and its hint (disabled=%s)', async disabled => {
    const onPress = jest.fn()
    await render(<IconBtn variant="plain" accessibilityLabel="Add place" accessibilityHint="Selection limit" onPress={onPress} disabled={disabled}><></></IconBtn>)
    const node = button('Add place')
    expect(flat(node)).toMatchObject({ width: 44, height: 44, borderWidth: 0, borderRadius: 0, backgroundColor: 'transparent' })
    expect(node.props.accessibilityHint).toBe('Selection limit')
    expect(node.props.accessibilityState.disabled).toBe(disabled)
    expect(flat(node).opacity ?? 1).toBe(disabled ? 0.5 : 1)
    await act(async () => fireEvent.press(node))
    expect(onPress).toHaveBeenCalledTimes(disabled ? 0 : 1)
  })

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

  it.each([false, true])('pressed keeps the resting fill and ring (active=%s)', async active => {
    await render(<IconBtn accessibilityLabel="Sao chép" onPress={jest.fn()} active={active}><></></IconBtn>)
    const resting = flat(button('Sao chép'))
    expect(await pressedStyle('Sao chép')).toEqual(resting)
  })

  it('disabled changes the fill and never fires', async () => {
    const onPress = jest.fn()
    await render(<IconBtn accessibilityLabel="Sao chép" onPress={onPress} disabled><></></IconBtn>)
    expect(flat(button('Sao chép')).backgroundColor).toBe(surface.subtle)
    await act(async () => fireEvent.press(button('Sao chép')))
    expect(onPress).not.toHaveBeenCalled()
  })
})

/**
 * #271 — the text buttons set `accessibilityState.busy` but no label. Android
 * builds `contentDescription` from label + state and only writes it when that
 * list is non-empty, so after `busy` went back to false a label-less button kept
 * announcing "busy" (seen in UI Automator dumps on a Samsung SM-A226B). With the
 * label on the host view the description is rewritten on every state change.
 */
describe.each([
  ['PrimaryBtn', PrimaryBtn],
  ['SecondaryBtn', SecondaryBtn],
  ['GhostBtn', GhostBtn],
  ['DangerBtn', DangerBtn],
] as const)('%s accessibility name (#271)', (_name, Btn) => {
  it('carries its label as accessibilityLabel through loading and after it ends', async () => {
    const view = await render(<Btn label="Đăng nhập" onPress={jest.fn()} loading />)
    const host = () => screen.getByRole('button')
    expect(host().props.accessibilityLabel).toBe('Đăng nhập')
    expect(host().props.accessibilityState).toMatchObject({ busy: true })

    await act(async () => {
      await view.rerender(<Btn label="Đăng nhập" onPress={jest.fn()} />)
    })
    expect(host().props.accessibilityLabel).toBe('Đăng nhập')
    expect(host().props.accessibilityState).toMatchObject({ busy: false, disabled: false })
  })
})

it('supports explicit icon slots while preserving legacy auth/onboarding arrows and loading suppression', async () => {
  const view = await render(<PrimaryBtn variant="stitch" label="Continue" icon="arrowRight" onPress={jest.fn()} />)
  expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
  await view.rerender(<PrimaryBtn variant="stitch" label="Apply" leadingIcon="tune" trailingIcon="arrowRight" loading onPress={jest.fn()} />)
  expect(screen.getByTestId('button-spinner', { includeHiddenElements: true })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
  expect(screen.getByText('Apply').props.numberOfLines).toBeUndefined()
})
