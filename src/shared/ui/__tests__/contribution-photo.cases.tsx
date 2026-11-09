import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react-native'
import { Animated, StyleSheet } from 'react-native'
import { StyleSheet as UnistylesSheet } from 'react-native-unistyles'
import { themes } from '../theme'
import { overlay } from '../tokens'
import '@/shared/i18n'

const mockOpenWebsite = jest.fn()
const mockMotion: { reduced: boolean | null } = { reduced: false }
const mockPhoto = { status: 'idle' }
jest.mock('@/shared/navigation/external-links', () => ({ openWebsite: (url: string) => mockOpenWebsite(url) }))
jest.mock('expo-image', () => ({ Image: jest.requireActual('react-native').Image }))
jest.mock('@/shared/ui/feedback', () => ({ ...jest.requireActual('@/shared/ui/feedback'), useReducedMotionPreference: () => mockMotion.reduced }))
jest.mock('@/shared/api', () => ({ ...jest.requireActual('@/shared/api'), useCandidatePhoto: () => mockPhoto }))

export function contributionPhotoTests(themeName: 'orange' | 'orangeDark') {
  UnistylesSheet.configure({ themes: { [themeName]: themes[themeName] } as typeof themes })
  const { ContributionPlaceCard } = jest.requireActual<typeof import('../contribution-place-card.view')>('../contribution-place-card.view')
  const { detailToPlaceCard } = jest.requireActual<typeof import('@/shared/api')>('@/shared/api')
  const place = {
    ...detailToPlaceCard({ id: 'p1', name: 'Photo café' }),
    photoUrl: 'https://example.com/photo.jpg', photoAttribution: 'Google Maps', photoSource: 'google' as const,
    photoAuthors: [{ displayName: 'Photographer', uri: 'https://example.com/author', photoUri: null }],
  }
  const card = (status: 'pending' | 'approved' | 'merged' | 'rejected' = 'pending') => <ContributionPlaceCard
    place={place} status={status} submittedDate="09/11/2026" />
  const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id, { includeHiddenElements: true }).props.style)
  beforeEach(() => { jest.useFakeTimers(); mockMotion.reduced = false; mockPhoto.status = 'idle'; mockOpenWebsite.mockReset() })
  afterEach(async () => { await cleanup(); jest.restoreAllMocks(); jest.clearAllTimers(); jest.useRealTimers() })

  it.each(['pending', 'approved', 'merged', 'rejected'] as const)('places date and credits only inside the photo (%s)', async status => {
    await render(card(status))
    const photo = within(screen.getByTestId('contribution-place-photo'))
    expect(photo.getByTestId('contribution-submitted-date')).toHaveTextContent('Gửi ngày 09/11/2026')
    expect(screen.getAllByText('Gửi ngày 09/11/2026')).toHaveLength(1)
    expect(photo.getByTestId('contribution-photo-credit')).toHaveTextContent('Ảnh: Photographer · Google Maps')
    expect(screen.getAllByTestId('saved-photo-attribution')).toHaveLength(1)
    expect(flat('contribution-photo-header')).toMatchObject({ position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6 })
    expect(flat('contribution-status').maxWidth).toBe('100%')
    expect(flat('contribution-submitted-date')).toMatchObject({ marginLeft: 'auto', maxWidth: '100%', backgroundColor: overlay.scrimText })
    expect(flat('contribution-photo-credit')).toMatchObject({ position: 'absolute', bottom: 10, left: 10, backgroundColor: overlay.scrimText })
    const stopPropagation = jest.fn()
    await fireEvent.press(screen.getByRole('link', { name: 'Photographer' }), { stopPropagation })
    expect(stopPropagation).toHaveBeenCalled()
    expect(mockOpenWebsite).toHaveBeenCalledWith('https://example.com/author')
  })

  it('shimmers while decoding, then removes the skeleton on load; error restores the neutral pin', async () => {
    await render(card())
    const loading = screen.getByTestId('place-photo-loading', { includeHiddenElements: true })
    expect(within(loading).queryByTestId('icon-map-pin', { includeHiddenElements: true })).toBeNull()
    await fireEvent(loading, 'layout', { nativeEvent: { layout: { width: 300, height: 176 } } })
    expect(screen.getByTestId('photo-skeleton-shimmer', { includeHiddenElements: true })).toBeTruthy()
    expect(flat('place-photo-loading')).toMatchObject({ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: themes[themeName].surface.subtle })
    const image = screen.getByTestId('place-photo-image')
    await act(async () => image.props.onLoad({ nativeEvent: {} }))
    expect(screen.queryByTestId('place-photo-loading', { includeHiddenElements: true })).toBeNull()
    expect(screen.getByTestId('place-photo-underlay', { includeHiddenElements: true })).toBeTruthy()
    await act(async () => image.props.onError({ nativeEvent: {} }))
    expect(screen.queryByTestId('place-photo-image')).toBeNull()
    expect(screen.getByTestId('place-photo-placeholder', { includeHiddenElements: true })).toBeTruthy()
  })

  it.each([true, null])('keeps a static skeleton when motion is reduced/unknown (%s)', async reduced => {
    mockMotion.reduced = reduced
    const loop = jest.spyOn(Animated, 'loop')
    await render(card())
    await fireEvent(screen.getByTestId('place-photo-loading', { includeHiddenElements: true }), 'layout', { nativeEvent: { layout: { width: 300, height: 176 } } })
    expect(screen.queryByTestId('photo-skeleton-shimmer', { includeHiddenElements: true })).toBeNull()
    expect(loop).not.toHaveBeenCalled()
  })

  it('stops a running shimmer when reduced motion changes', async () => {
    const stop = jest.fn()
    jest.spyOn(Animated, 'loop').mockReturnValue({ start: jest.fn(), stop, reset: jest.fn() })
    const view = await render(card())
    await fireEvent(screen.getByTestId('place-photo-loading', { includeHiddenElements: true }), 'layout', { nativeEvent: { layout: { width: 300, height: 176 } } })
    mockMotion.reduced = true
    await view.rerender(card())
    expect(stop).toHaveBeenCalled()
    expect(screen.queryByTestId('photo-skeleton-shimmer', { includeHiddenElements: true })).toBeNull()
  })

  it('also shows the shared skeleton while the provider photo request is pending', async () => {
    mockPhoto.status = 'loading'
    await render(<ContributionPlaceCard preview={{ name: 'Pending photo' }} status="pending" />)
    expect(screen.getByTestId('contribution-photo-fetch-loading', { includeHiddenElements: true })).toBeTruthy()
  })

  it('omits a missing date/credit and leaves no-photo cards neutral', async () => {
    await render(<ContributionPlaceCard place={{ ...place, photoUrl: null, photoAttribution: null, photoAuthors: [] }} status="approved" />)
    expect(screen.queryByTestId('contribution-submitted-date')).toBeNull()
    expect(screen.queryByTestId('contribution-photo-credit')).toBeNull()
    expect(screen.queryByTestId('place-photo-loading', { includeHiddenElements: true })).toBeNull()
    expect(screen.getByTestId('place-photo-placeholder', { includeHiddenElements: true })).toBeTruthy()
  })

  it('keeps date and credit text above AA even over a white image', async () => {
    await render(card())
    const foreground = flat('contribution-submitted-date').color as string
    expect(foreground).toBe(themes[themeName].onDark.strong)
    const alpha = Number(foreground.match(/[\d.]+(?=\))/)![0])
    const scrimAlpha = Number(overlay.scrimText.match(/[\d.]+(?=\))/)![0])
    const background = 1 - scrimAlpha
    const text = alpha + background * (1 - alpha)
    const luminance = (channel: number) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    expect((luminance(text) + 0.05) / (luminance(background) + 0.05)).toBeGreaterThanOrEqual(4.5)
    expect(StyleSheet.flatten(screen.getByTestId('saved-photo-attribution').props.style).color).toBe(foreground)
  })
}
