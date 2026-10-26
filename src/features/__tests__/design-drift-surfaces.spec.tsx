import { act, fireEvent, render, screen, within } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import i18n from '@/shared/i18n'
import { accents, surface, text } from '@/shared/ui/tokens'

import { loaded as mockLoaded, renderScreen } from './harness'

/**
 * #382 (UI-AI-002 §1, §3–§5, §7) on the screens it names: the check-in toggle
 * follows the theme accent, the place sheet's save toggle is an icon rather
 * than 🔖/📑, its unavailable Report reads at a measured colour, its
 * suitability scores are not titled for couples, Profile's settings rows carry
 * icons and a pressed state, and the splash tagline is translated.
 */

const mockDetail: { value: Record<string, unknown> } = { value: {} }

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ placeId: 'place-1' }),
}))
jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ status: 'user', session: { kind: 'user', userId: 'u' }, signOut: jest.fn() }),
}))
jest.mock('@/shared/storage/onboarding', () => ({
  hasCompletedOnboarding: async () => true,
  markOnboardingComplete: async () => undefined,
}))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  usePlaceDetail: () => mockLoaded(mockDetail.value),
  usePlaceReviews: () => mockLoaded({ source: 'gogo', order: 'latest', reviews: [] }),
  useMyReviewReactions: () => mockLoaded({ placeId: 'place-1', helpful: [] }),
  useToggleReviewHelpful: () => ({ mutate: jest.fn(), isPending: false, variables: undefined }),
  useSaved: () => mockLoaded([]),
  useToggleSaved: () => ({ mutate: jest.fn() }),
  useTaxonomyLabel: () => ({ resolve: (_kind: string, key: string) => key }),
  useMe: () => mockLoaded({ displayName: 'Mai' }),
  useMyReviews: () => mockLoaded([]),
  useNotificationSettings: () => mockLoaded({}),
  useUploadImage: () => ({ mutateAsync: jest.fn(), isPending: false }),
}))

import { styles as checkinStyles } from '@/features/active-date/checkin-sheet.style'
import { CheckinSheet } from '@/features/active-date/checkin-sheet.view'
import PlaceDetailScreen from '@/features/date-plan/place-detail.view'
import SplashScreen from '@/features/onboarding/splash.view'
import ProfileScreen from '@/features/tabs/profile.view'

const flat = (style: unknown) => StyleSheet.flatten(style as never) as Record<string, unknown>

afterEach(async () => {
  await act(async () => {
    await i18n.changeLanguage('vi')
  })
})

describe('check-in bill toggle (#382 §5)', () => {
  it('is the theme accent — soft fill, onSoft label — not a fixed lavender', () => {
    // jest resolves Unistyles against the first theme, orange.
    expect(flat(checkinStyles.billToggleOn)).toMatchObject({
      backgroundColor: accents.orange.soft,
      borderColor: accents.orange.primary,
    })
    expect(flat(checkinStyles.billToggleLabelOn).color).toBe(accents.orange.onSoft)
    expect(flat(checkinStyles.billToggleMark).color).toBe(accents.orange.onSoft)
  })
})

describe('check-in sheet (#382 §2, on #381 Sheet)', () => {
  it('rates with star icons — filled to the rating, outlined past it — and no emoji', async () => {
    await render(
      <CheckinSheet
        visible
        stop={{ id: 'stop-1', placeId: 'place-1' } as never}
        placeName="Quán thử"
        pending={false}
        error={null}
        onSave={jest.fn()}
        onSkip={jest.fn()}
      />,
    )
    expect(screen.queryByText('⭐')).toBeNull()
    expect(screen.queryByText('📍')).toBeNull()
    await act(async () => {
      await fireEvent.press(screen.getByLabelText(i18n.t('review.starAria', { count: 3 })))
    })
    expect(screen.getByTestId('checkin-star-3-filled')).toBeTruthy()
    expect(screen.getByTestId('checkin-star-4')).toBeTruthy()
  })
})

describe('place sheet (#382 §2, §4, §7)', () => {
  const PLACE = { id: 'place-1', name: 'Quán thử', photos: [], suitability: { date_night: 0.8 } }

  it('draws the save toggle as the bookmark icon, not an emoji', async () => {
    mockDetail.value = PLACE
    const view = await renderScreen(<PlaceDetailScreen />)
    expect(view.getByTestId('icon-bookmark')).toBeTruthy()
    expect(view.queryByText('📑')).toBeNull()
    expect(view.queryByText('🔖')).toBeNull()
  })

  it('titles the suitability scores without assuming a couple', async () => {
    mockDetail.value = PLACE
    const view = await renderScreen(<PlaceDetailScreen />)
    expect(view.queryByText('Đánh giá từ các cặp đôi')).toBeNull()
    expect(view.getByText('Phù hợp với')).toBeTruthy()
  })

  it('the unavailable Report reads text.secondary on surface.subtle — a disabled control, not a 1.6:1 ghost', async () => {
    mockDetail.value = PLACE
    const view = await renderScreen(<PlaceDetailScreen />)
    const label = view.getByText('Báo thông tin sai')
    expect(flat(label.props.style).color).toBe(text.secondary)
    expect(flat(view.getByTestId('place-detail-report').props.style).backgroundColor).toBe(surface.subtle)
  })
})

describe('Profile settings rows (#382 §1, §2)', () => {
  it('each row carries an icon from icons.tsx and its label has no emoji', async () => {
    const view = await renderScreen(<ProfileScreen />)
    for (const [label, icon] of [
      ['Hộp thư', 'icon-inbox'],
      ['Thông báo và vị trí', 'icon-bell'],
      ['Đánh giá của tôi', 'icon-star'],
      ['Tài khoản', 'icon-settings'],
    ]) {
      const row = view.getByTestId(`profile-setting-${label}`)
      expect(within(row).getByText(label)).toBeTruthy()
      expect(within(row).getByTestId(icon)).toBeTruthy()
    }
  })

  it('a pressed row changes its fill to surface.subtle', async () => {
    const view = await renderScreen(<ProfileScreen />)
    const row = view.getByTestId('profile-setting-Hộp thư')
    expect(flat(row.props.style).backgroundColor).toBeUndefined()
    await act(async () => {
      // Pressability's own entry point: a touch the responder system granted.
      await fireEvent(row, 'responderGrant', {
        persist: () => undefined,
        currentTarget: { measure: () => undefined },
        nativeEvent: { timestamp: 0, pageX: 0, pageY: 0, locationX: 0, locationY: 0, touches: [], changedTouches: [] },
      })
    })
    expect(flat(view.getByTestId('profile-setting-Hộp thư').props.style).backgroundColor).toBe(surface.subtle)
  })
})

describe('splash tagline (#382 §7)', () => {
  it('is an i18n string, so English reads English', async () => {
    await act(async () => {
      await i18n.changeLanguage('en')
    })
    await render(<SplashScreen />)
    expect(screen.queryByText('Có kèo, đi đâu.')).toBeNull()
    expect(screen.getByText('Plans made, places found.')).toBeTruthy()
  })
})
