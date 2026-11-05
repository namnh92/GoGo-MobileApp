import { act, fireEvent, render, screen } from '@testing-library/react-native'

import OnboardingScreen from '@/features/onboarding/onboarding.view'
import i18n from '@/shared/i18n'

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn() }) }))
jest.mock('@/shared/notifications/permission-bootstrap', () => ({ pushPermission: { request: jest.fn(async () => undefined) } }))
jest.mock('@/shared/storage/onboarding', () => ({ markOnboardingComplete: jest.fn(async () => undefined) }))

/** Every drawn string, including the visual that is hidden from screen readers. */
function drawnText() {
  return screen.getAllByText(/./, { includeHiddenElements: true }).map(n => n.props.children).flat().join(' | ')
}

describe('onboarding visuals', () => {
  it.each(['vi', 'en'])('draws each slide with no price, rating, emoji or place name (%s)', async lng => {
    await act(async () => { await i18n.changeLanguage(lng) })
    await render(<OnboardingScreen />)
    for (let slide = 0; slide < 3; slide++) {
      expect(screen.getByTestId('onboarding-visual', { includeHiddenElements: true })).toBeTruthy()
      const text = drawnText()
      expect(text).not.toMatch(/\d[.,]\d|\d\s?(k|đ|₫)\b|★/)
      expect(text).not.toMatch(/\p{Extended_Pictographic}/u)
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
