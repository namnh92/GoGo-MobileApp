import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Image, type ImageProps } from 'expo-image'

import OnboardingScreen from '@/features/onboarding/onboarding.view'
import { artwork } from '@/features/onboarding/onboarding-artwork'
import i18n from '@/shared/i18n'

// Assert the public Image props before Expo normalizes them for its native child.
jest.mock('expo-image', () => ({ Image: jest.fn((_props: ImageProps) => null) }))
// Jest Expo maps every real JPEG to 1. Distinct local IDs expose source swaps.
jest.mock('../../../../assets/images/onboarding/debate-cafe.jpg', () => 101)
jest.mock('../../../../assets/images/onboarding/swipe-mua-cafe.jpg', () => 105)
jest.mock('../../../../assets/images/onboarding/swipe-oven-trattoria.jpg', () => 103)
jest.mock('../../../../assets/images/onboarding/swipe-workshop-cafe.jpg', () => 104)
jest.mock('../../../../assets/images/onboarding/plan-moc-rieu.jpg', () => 106)
jest.mock('../../../../assets/images/onboarding/plan-gac-cafe.jpg', () => 102)

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn() }) }))
jest.mock('@/shared/notifications/permission-bootstrap', () => ({ pushPermission: { request: jest.fn(async () => undefined) } }))
jest.mock('@/shared/storage/onboarding', () => ({ markOnboardingComplete: jest.fn(async () => undefined) }))

/** Every drawn string, including the visual that is hidden from screen readers. */
function drawnText() {
  return screen.getAllByText(/./, { includeHiddenElements: true }).map(n => n.props.children).flat().join(' | ')
}

describe('onboarding visuals', () => {
  it('passes all six bundled assets directly to Image in approved slide order', async () => {
    expect(artwork).toEqual({ debate: [101], swipe: [105, 103, 104], plan: [106, 102] })
    await act(async () => { await i18n.changeLanguage('vi') })
    const image = jest.mocked(Image)
    image.mockClear()
    await render(<OnboardingScreen />)
    const slides = [[101], [105, 103, 104], [106, 102]]
    for (let slide = 0; slide < slides.length; slide++) {
      const props = image.mock.calls.map(([props]) => props)
      expect(props.map(props => props.source)).toEqual(slides[slide])
      for (const prop of props) {
        expect(prop.contentFit).toBe('contain')
        expect(prop.transition).toBe(0)
      }
      if (slide < 2) {
        image.mockClear()
        await fireEvent.press(screen.getByText(i18n.t('onboarding.next')))
      }
    }
  })

  it.each(['vi', 'en'])('draws approved static sample content only in the hidden illustration (%s)', async lng => {
    await act(async () => { await i18n.changeLanguage(lng) })
    await render(<OnboardingScreen />)
    for (let slide = 0; slide < 3; slide++) {
      expect(screen.getByTestId('onboarding-visual', { includeHiddenElements: true })).toBeTruthy()
      const text = drawnText()
      const expected = slide === 0 ? i18n.t('onboarding.art.debatePlace') : slide === 1 ? i18n.t('onboarding.art.price') : i18n.t('onboarding.art.match')
      expect(text).toContain(expected)
      expect(screen.queryByText(expected)).toBeNull()
      expect(text).not.toMatch(/onboarding\.(art|slide)\./)
      if (slide < 2) await fireEvent.press(screen.getByText(i18n.t('onboarding.next')))
    }
    await act(async () => { await i18n.changeLanguage('vi') })
  })

  it('keeps skip, next, start and guest', async () => {
    await act(async () => { await i18n.changeLanguage('vi') })
    await render(<OnboardingScreen />)
    expect(screen.getByText(i18n.t('onboarding.skip'))).toBeTruthy()
    await fireEvent.press(screen.getByText(i18n.t('onboarding.next')))
    await fireEvent.press(screen.getByText(i18n.t('onboarding.next')))
    expect(screen.getByText(i18n.t('onboarding.start'))).toBeTruthy()
    expect(screen.getByText(i18n.t('onboarding.guest'))).toBeTruthy()
  })
})
