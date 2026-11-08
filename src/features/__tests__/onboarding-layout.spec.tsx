import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Dimensions, StyleSheet } from 'react-native'
import i18n from '@/shared/i18n'
import { buttonSizes, touchTarget } from '@/shared/ui/tokens'
import { fitIllustration } from '../onboarding/onboarding-layout'

let mockInsets = { top: 20, bottom: 0, left: 0, right: 0 }
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => mockInsets }))
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn() }) }))
jest.mock('@/shared/notifications/permission-bootstrap', () => ({ pushPermission: { request: jest.fn() } }))
import Onboarding from '../onboarding/onboarding.view'

const hidden = { includeHiddenElements: true }
const flat = (style: unknown) => StyleSheet.flatten(style as never) as Record<string, number | string | undefined>
const event = (width: number, height: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width, height } } })
const original = Dimensions.get('window')
const phones = [
  { name: 'SE', width: 375, height: 667, top: 20, bottom: 0 },
  { name: '16', width: 393, height: 852, top: 62, bottom: 34 },
  { name: 'reference', width: 390, height: 884, top: 47, bottom: 34 },
]
// Injected natural geometry; system font scale never changes glyph metrics.
const geometry = (slide: number) => ({
  header: 44,
  narrative: [116, 116, 124][slide],
  dots: slide === 2 ? 6 : 14,
  actions: slide === 2 ? 100 : 48,
  art: [350, 340, 440][slide],
})
const spacing = (slide: number) => [98, 98, 132][slide]
const visual = () => screen.getByTestId('onboarding-visual', hidden)
const actions = (slide: number) => screen.getByRole('button', { name: i18n.t(slide === 2 ? 'onboarding.start' : 'onboarding.next') }).parent!
function scrollAncestor(node: ReturnType<typeof screen.getByText>) {
  let ancestor = node.parent
  while (ancestor && ancestor.type !== 'RCTScrollView') ancestor = ancestor.parent
  return ancestor
}
const upper = () => scrollAncestor(visual())!

async function mount(phone: typeof phones[number], fontScale: number, slide: number) {
  mockInsets = { top: phone.top, bottom: phone.bottom, left: 0, right: 0 }
  await act(async () => { Dimensions.set({ window: { ...original, width: phone.width, height: phone.height, fontScale } }) })
  await render(<Onboarding />)
  for (let index = 0; index < slide; index++) await fireEvent.press(screen.getByText(i18n.t('onboarding.next')))
}

async function measure(phone: typeof phones[number], slide: number) {
  const g = geometry(slide)
  await act(async () => {
    screen.queryByTestId('onboarding-viewport')?.props.onLayout(event(phone.width, phone.height))
  })
  await act(async () => {
    // Optional calls make the baseline fail on overflow, not missing hooks.
    screen.queryByTestId('onboarding-header')?.props.onLayout(event(phone.width - 40, g.header))
    screen.queryByTestId('onboarding-narrative')?.props.onLayout(event(phone.width - 40, g.narrative))
    screen.queryByTestId('onboarding-dots')?.props.onLayout(event(phone.width - 40, g.dots))
    actions(slide).props.onLayout?.(event(phone.width - 40, g.actions))
    const art = visual().children[0] as ReturnType<typeof screen.getByTestId>
    if (slide !== 1) art.props.onLayout(event(350, g.art))
    else {
      const labels = ['onboarding.art.workshop', 'onboarding.art.mua', 'onboarding.art.oven'] as const
      const rectangles = [[47, 0, 256, g.art], [2, 32, 224, 180], [124, 56, 224, 180]]
      labels.forEach((key, index) => {
        const [x, y, width, height] = rectangles[index]
        screen.getByText(i18n.t(key), hidden).parent!.props.onLayout({ nativeEvent: { layout: { x, y, width, height } } })
      })
    }
  })
  return g
}

afterEach(async () => { await act(async () => { Dimensions.set({ window: original }); await i18n.changeLanguage('vi') }) })

describe('S-01 measured whole-screen fit', () => {
  it.each(phones.flatMap(phone => [0, 1, 2].map(slide => ({ ...phone, slide }))))('$name slide $slide fits all natural blocks and both final actions at scale 1', async phone => {
    await mount(phone, 1, phone.slide)
    const g = await measure(phone, phone.slide)
    const required = Number(flat(visual().props.style).height) + g.header + g.narrative + g.dots + g.actions + spacing(phone.slide) + phone.top + phone.bottom
    expect(required).toBeLessThanOrEqual(phone.height + 0.001)
    const independent = fitIllustration(phone.width, phone.height, phone.top, phone.bottom, g.art)
    if (phone.slide !== 1 && independent.height + required - Number(flat(visual().props.style).height) <= phone.height) {
      expect(flat(visual().props.style)).toMatchObject({ width: independent.width, height: independent.height })
    }
    expect(upper().props.scrollEnabled).not.toBe(true)
    if (phone.slide === 2) {
      expect(flat(upper().props.contentContainerStyle).gap).toBeCloseTo(Math.max(0, phone.height - required) / 4)
      expect(flat(actions(2).props.style).marginTop).toBeCloseTo(16 + Math.max(0, phone.height - required) / 4)
    }
    expect(flat(screen.getByTestId('onboarding-actions').parent!.props.style).paddingBottom).toBe(phone.bottom + 20)
    for (const key of [phone.slide === 2 ? 'onboarding.start' : 'onboarding.next', ...(phone.slide === 2 ? ['onboarding.guest'] as const : [])] as const) {
      const button = screen.getByRole('button', { name: i18n.t(key) })
      const height = Number(flat(button.props.style).minHeight)
      expect(height).toBe(key === 'onboarding.guest' ? buttonSizes.small.minHeight : buttonSizes.regular.minHeight)
      expect(height + button.props.hitSlop.top + button.props.hitSlop.bottom).toBeGreaterThanOrEqual(touchTarget.min)
      expect(button.children[0]).toBeDefined()
    }
  })
})

describe('fixed font composition', () => {
  it.each(phones.flatMap(phone => [0, 1, 2].flatMap(slide => [1.3, 2].map(fontScale => ({ ...phone, slide, fontScale })))))('$name slide $slide keeps layout unchanged at scale $fontScale', async phone => {
    await mount(phone, phone.fontScale, phone.slide)
    const g = await measure(phone, phone.slide)
    const layout = flat(visual().props.style)
    const required = Number(layout.height) + g.header + g.narrative + g.dots + g.actions + spacing(phone.slide) + phone.top + phone.bottom
    expect(required).toBeLessThanOrEqual(phone.height + 0.001)
    expect(scrollAncestor(actions(phone.slide))).toBeNull()
    expect(upper().props.scrollEnabled).toBe(false)
    const before = { ...layout }
    const oldActions = screen.getByTestId('onboarding-actions')
    await act(async () => { Dimensions.set({ window: { ...Dimensions.get('window'), fontScale: 1 } }) })
    expect(flat(visual().props.style)).toEqual(before)
    expect(screen.getByTestId('onboarding-actions')).toBe(oldActions)
    for (const key of [phone.slide === 2 ? 'onboarding.start' : 'onboarding.next', ...(phone.slide === 2 ? ['onboarding.guest'] as const : [])] as const) {
      const label = screen.getByText(i18n.t(key))
      expect(label.props.allowFontScaling).toBe(false)
      expect(label.props.numberOfLines).toBeUndefined()
    }
  })
})

it.each([1, 1.3, 2])('keeps usable actions and proportional artwork on the 360×640 guard at scale %s', async fontScale => {
  const phone = { name: 'guard', width: 360, height: 640, top: 20, bottom: 0 }
  await mount(phone, fontScale, 2)
  const g = await measure(phone, 2)
  const art = flat(visual().props.style)
  expect(Number(art.width) / Number(art.height)).toBeCloseTo(350 / g.art)
  expect(Number(art.height)).toBeGreaterThan(0)
  expect(scrollAncestor(actions(2))).toBeNull()
  expect(upper().props.scrollEnabled).toBe(false)
})

it('waits for complete reordered measurements, rejects wrong widths, and accepts smaller natural heights without a fit feedback loop', async () => {
  const phone = phones[0]
  await mount(phone, 1, 2)
  await act(async () => { screen.getByTestId('onboarding-viewport').props.onLayout(event(phone.width, phone.height)) })
  const g = geometry(2)
  const emit = (id: string, height: number, width = phone.width - 40) => screen.getByTestId(id).props.onLayout(event(width, height))
  await act(async () => {
    emit('onboarding-actions', g.actions)
    emit('onboarding-dots', g.dots)
    emit('onboarding-header', g.header)
    emit('onboarding-narrative', g.narrative, 200) // another width is stale
    ;(visual().children[0] as ReturnType<typeof screen.getByTestId>).props.onLayout(event(350, g.art))
  })
  expect(upper().props.scrollEnabled).toBe(true)
  const independentHeight = Number(flat(visual().props.style).height)
  await act(async () => { emit('onboarding-narrative', g.narrative) })
  expect(upper().props.scrollEnabled).toBe(false)
  const smallHeight = Number(flat(visual().props.style).height)
  expect(smallHeight).toBeLessThan(independentHeight)
  await act(async () => { emit('onboarding-narrative', 60) })
  expect(Number(flat(visual().props.style).height)).toBeCloseTo(smallHeight + g.narrative - 60)
  const settled = flat(visual().props.style)
  await act(async () => { emit('onboarding-narrative', 60) })
  expect(flat(visual().props.style)).toEqual(settled)
})

it('resets scroll and measurements on Next/Back, rejecting callbacks from the previous visit', async () => {
  const phone = phones[0]
  await mount(phone, 1.35, 1)
  await measure(phone, 1)
  const oldScroll = upper()
  const oldNarrative = screen.getByTestId('onboarding-narrative').props.onLayout
  await fireEvent.press(screen.getByText(i18n.t('onboarding.next')))
  expect(upper()).not.toBe(oldScroll)
  expect(upper().props.contentOffset).toEqual({ x: 0, y: 0 })
  await measure(phone, 2)
  await fireEvent.press(screen.getByRole('button', { name: i18n.t('common.back') }))
  expect(upper()).not.toBe(oldScroll)
  expect(upper().props.contentOffset).toEqual({ x: 0, y: 0 })
  expect(upper().props.scrollEnabled).toBe(true)
  await measure(phone, 1)
  expect(upper().props.scrollEnabled).toBe(false)
  await act(async () => { oldNarrative(event(phone.width - 40, 900)) })
  expect(upper().props.scrollEnabled).toBe(false)
})

it.each(['window', 'insets', 'language', 'viewport'] as const)('invalidates the complete set on a change to %s, including stale callbacks after a round trip', async change => {
  const phone = phones[0]
  await mount(phone, 1, 0)
  await measure(phone, 0)
  const oldNarrative = screen.getByTestId('onboarding-narrative').props.onLayout
  const oldViewport = screen.getByTestId('onboarding-viewport').props.onLayout
  const oldArt = (visual().children[0] as ReturnType<typeof screen.getByTestId>).props.onLayout
  expect(upper().props.scrollEnabled).toBe(false)
  if (change === 'language') await act(async () => { await i18n.changeLanguage('en') })
  else if (change === 'insets') {
    mockInsets = { ...mockInsets, bottom: 34 }
    await screen.rerender(<Onboarding />)
  } else if (change === 'viewport') await act(async () => { oldViewport(event(phone.width, phone.height - 40)) })
  else await act(async () => { Dimensions.set({ window: { ...Dimensions.get('window'), width: 393, height: 852 } }) })
  expect(upper().props.scrollEnabled).toBe(true)
  await act(async () => { oldNarrative(event(phone.width - 40, 20)); oldArt(event(350, 100)) })
  expect(upper().props.scrollEnabled).toBe(true)
  // Returning to the same environment must not make old callbacks valid again.
  mockInsets = { top: phone.top, bottom: phone.bottom, left: 0, right: 0 }
  await act(async () => {
    Dimensions.set({ window: { ...original, width: phone.width, height: phone.height, fontScale: 1 } })
    await i18n.changeLanguage('vi')
  })
  await screen.rerender(<Onboarding />)
  if (change === 'viewport') await act(async () => { screen.getByTestId('onboarding-viewport').props.onLayout(event(phone.width, phone.height)) })
  const currentNarrative = screen.getByTestId('onboarding-narrative')
  await act(async () => { oldViewport(event(100, 100)); oldNarrative(event(phone.width - 40, 900)) })
  expect(screen.getByTestId('onboarding-narrative')).toBe(currentNarrative)
})

// O-5: fitting content must still consume the upper space, placing the actions
// at the safe bottom, rather than leaving unused space underneath them.
it('anchors the footer even when natural content leaves surplus height, and provides Back on slide 2', async () => {
  await mount(phones[1], 1, 1)
  await measure(phones[1], 1)
  const scroll = upper()
  expect(flat(scroll.props.style).flex).toBe(1)
  expect(scrollAncestor(actions(1))).toBeNull()
  expect(screen.getByRole('button', { name: i18n.t('common.back') })).toBeTruthy()
})

it('keeps actions outside the upper scroll even when a short screen has no art budget', async () => {
  await mount(phones[0], 1, 2)
  await measure(phones[0], 2)
  await fireEvent(screen.getByTestId('onboarding-narrative'), 'layout', event(phones[0].width - 40, 800))
  expect(scrollAncestor(actions(2))).toBeNull()
  expect(upper().props.scrollEnabled).toBe(true)
  expect(screen.getAllByRole('button', { name: i18n.t('onboarding.start') })).toHaveLength(1)
  expect(screen.getAllByRole('button', { name: i18n.t('onboarding.guest') })).toHaveLength(1)
})

// F-02: wrapped action labels can exhaust a very short viewport even with fixed fonts.
it.each([1, 1.3, 2])('scrolls the whole screen when measured actions exhaust the viewport at scale %s', async fontScale => {
  const phone = { name: 'very short', width: 320, height: 240, top: 20, bottom: 34 }
  await mount(phone, fontScale, 2)
  await measure(phone, 2)
  await fireEvent(screen.getByTestId('onboarding-actions'), 'layout', event(phone.width - 40, 180))
  const whole = screen.getByTestId('onboarding-whole')
  expect(scrollAncestor(actions(2))).toBe(whole)
  expect(scrollAncestor(visual())).toBe(whole)
  expect(whole.props.scrollEnabled).not.toBe(false)
  expect(screen.queryByTestId('onboarding-upper')).toBeNull()
  expect(flat(whole.props.contentContainerStyle)).toMatchObject({ paddingTop: phone.top, paddingBottom: phone.bottom + 20 })
  const buttons = screen.getAllByRole('button')
  expect(buttons.indexOf(screen.getByRole('button', { name: i18n.t('onboarding.start') })))
    .toBeLessThan(buttons.indexOf(screen.getByRole('button', { name: i18n.t('onboarding.guest') })))
  // Shrinking the measured group restores the ordinary fixed footer.
  await fireEvent(screen.getByTestId('onboarding-actions'), 'layout', event(phone.width - 40, 100))
  expect(screen.queryByTestId('onboarding-whole')).toBeNull()
  expect(scrollAncestor(actions(2))).toBeNull()
})
