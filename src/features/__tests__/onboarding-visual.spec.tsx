import { act, render, screen } from '@testing-library/react-native'
import { Dimensions, StyleSheet } from 'react-native'
import i18n from '@/shared/i18n'
import { OnboardingVisual } from '../onboarding/onboarding-visual.view'

const flat = (style: unknown) => StyleSheet.flatten(style as never) as Record<string, number | string | undefined>
const layout = (x: number, y: number, width: number, height: number) => ({ nativeEvent: { layout: { x, y, width, height } } })

it('reserves measured enlarged cards including their rotated union, beyond the fixed 340-point stack', async () => {
  await render(<OnboardingVisual slide={1} />)
  const main = screen.getByText(i18n.t('onboarding.art.workshop'), { includeHiddenElements: true }).parent!
  const left = screen.getByText(i18n.t('onboarding.art.mua'), { includeHiddenElements: true }).parent!
  const right = screen.getByText(i18n.t('onboarding.art.oven'), { includeHiddenElements: true }).parent!
  // Optional invocation lets the original product expose its insufficient fixed
  // reservation (340), rather than failing only because forwarding was absent.
  await act(async () => {
    main.props.onLayout?.(layout(47, -130, 256, 600))
    left.props.onLayout?.(layout(2, 32, 224, 560))
    right.props.onLayout?.(layout(124, 56, 224, 600))
  })
  const stage = main.parent!
  const stack = stage.parent!
  // The old main parent IS the fixed stack. It has no reservation wrapper.
  const reservation = typeof main.props.onLayout === 'function' ? flat(stack.props.style) : flat(stage.props.style)
  expect(reservation.height).toBeGreaterThanOrEqual(790)
  expect(reservation.width).toBeGreaterThan(350)
  expect(typeof main.props.onLayout).toBe('function')
  expect(typeof left.props.onLayout).toBe('function')
  expect(typeof right.props.onLayout).toBe('function')
  expect(flat(stage.props.style).height).toBe(340)
  expect(flat(stage.props.style).top).toBeGreaterThan(0)
  const before = { ...reservation }
  await act(async () => { main.props.onLayout(layout(47, -130, 256, 600)) })
  expect(flat(stack.props.style)).toEqual(before)
  const visual = flat(screen.getByTestId('onboarding-visual', { includeHiddenElements: true }).props.style)
  expect(Number(visual.width) / Number(visual.height)).toBeCloseTo(Number(reservation.width) / Number(reservation.height), 6)
})

it('lets photo badges wrap and grow internally instead of overlapping in a clipped 128-point viewport', async () => {
  await render(<OnboardingVisual slide={1} />)
  const label = screen.getByText(i18n.t('onboarding.art.suggested'), { includeHiddenElements: true })
  const recommendation = label.parent!
  const priceLabel = screen.getByText(i18n.t('onboarding.art.price'), { includeHiddenElements: true })
  const price = priceLabel.parent!
  const photo = recommendation.parent!
  const photoStyle = flat(photo.props.style)
  expect(photoStyle.height).toBeUndefined()
  expect(photoStyle.minHeight).toBe(128)
  expect(photoStyle.padding).toBe(8)
  expect(photoStyle.gap).toBe(8)
  expect(photoStyle.justifyContent).toBe('space-between')
  expect(photoStyle.overflow).toBe('hidden')
  expect(price.parent).toBe(photo)
  for (const badge of [recommendation, price]) {
    const style = flat(badge.props.style)
    expect(style.position).not.toBe('absolute')
    expect(style.maxWidth).toBe('100%')
  }
  for (const text of [label, priceLabel]) {
    expect(text.props.numberOfLines).toBeUndefined()
    expect(flat(text.props.style).flexShrink).toBe(1)
  }
  expect(flat(price.props.style).alignSelf).toBe('flex-end')
})


const hidden = { includeHiddenElements: true }
const cards = () => ({
  main: screen.getByText(i18n.t('onboarding.art.workshop'), hidden).parent!,
  left: screen.getByText(i18n.t('onboarding.art.mua'), hidden).parent!,
  right: screen.getByText(i18n.t('onboarding.art.oven'), hidden).parent!,
})
const reservation = () => flat(cards().main.parent!.parent!.props.style)
async function enlargeCards() {
  const { main, left, right } = cards()
  await act(async () => {
    main.props.onLayout(layout(47, -130, 256, 600))
    left.props.onLayout(layout(2, 32, 224, 560))
    right.props.onLayout(layout(124, 56, 224, 600))
  })
}

it('waits for every card, accepts reordered events, and shrinks again after smaller measurements', async () => {
  await render(<OnboardingVisual slide={1} />)
  const { main, left, right } = cards()
  await act(async () => { right.props.onLayout(layout(124, 56, 224, 600)) })
  expect(reservation()).toMatchObject({ width: 350, height: 340 })
  await act(async () => { main.props.onLayout(layout(47, -130, 256, 600)) })
  expect(reservation()).toMatchObject({ width: 350, height: 340 })
  await act(async () => { left.props.onLayout(layout(2, 32, 224, 560)) })
  expect(reservation().height).toBeGreaterThan(790)
  await act(async () => {
    main.props.onLayout(layout(47, 30, 256, 280))
    left.props.onLayout(layout(2, 32, 224, 160))
    right.props.onLayout(layout(124, 56, 224, 160))
  })
  expect(reservation().height).toBe(340)
  expect(Number(reservation().width)).toBeLessThan(400)
  // The real accessibility contract remains intact.
  expect(screen.queryByTestId('onboarding-visual')).toBeNull()
  expect(screen.getByTestId('onboarding-visual', hidden).props.accessibilityElementsHidden).toBe(true)
})

it('discards old S30 measurements when leaving and returning to the slide', async () => {
  await render(<OnboardingVisual slide={1} />)
  await enlargeCards()
  expect(reservation().height).toBeGreaterThan(790)
  await screen.rerender(<OnboardingVisual slide={2} />)
  await screen.rerender(<OnboardingVisual slide={1} />)
  expect(reservation()).toMatchObject({ width: 350, height: 340 })
})

it.each([
  { width: 320, height: 568, fontScale: 1 },
  { width: 844, height: 390, fontScale: 1 },
  { width: 390, height: 844, fontScale: 2 },
])('invalidates measurements for a new window/font scale %o', async change => {
  const original = Dimensions.get('window')
  try {
    await render(<OnboardingVisual slide={1} />)
    await enlargeCards()
    expect(reservation().height).toBeGreaterThan(790)
    await act(async () => { Dimensions.set({ window: { ...original, ...change } }) })
    expect(reservation()).toMatchObject({ width: 350, height: 340 })
    await enlargeCards()
    const fitted = flat(screen.getByTestId('onboarding-visual', hidden).props.style)
    expect(Number(fitted.width)).toBeLessThanOrEqual(change.width - 40)
    expect(Number(fitted.height)).toBeLessThanOrEqual((change.height - 81) * 0.48 + 0.000001)
  } finally {
    await act(async () => { Dimensions.set({ window: original }) })
  }
})


it('constrains S30 header rows so enlarged labels cannot escape the measured cards', async () => {
  await render(<OnboardingVisual slide={1} />)
  const hint = screen.getByText(i18n.t('onboarding.slide2.swipe'), hidden)
  expect(flat(hint.parent!.parent!.props.style).flexWrap).toBe('wrap')
  expect(flat(hint.parent!.props.style)).toMatchObject({ minWidth: 0, maxWidth: '100%', flexShrink: 1 })
  expect(flat(hint.props.style)).toMatchObject({ minWidth: 0, flexShrink: 1 })
  for (const name of ['onboarding.art.trang', 'onboarding.art.quan'] as const) {
    const label = screen.getByText(i18n.t(name), hidden)
    expect(flat(label.parent!.props.style)).toMatchObject({ flex: 1, minWidth: 0 })
    expect(flat(label.props.style)).toMatchObject({ minWidth: 0, flexShrink: 1 })
    expect(label.props.numberOfLines).toBeUndefined()
  }
})
