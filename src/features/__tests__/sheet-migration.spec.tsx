import { act, fireEvent, screen, within } from '@testing-library/react-native'
import { AccessibilityInfo, DeviceEventEmitter, StyleSheet } from 'react-native'

import { loaded as mockLoaded, renderScreen as renderBare } from './harness'

/**
 * GoGo-MobileApp#381 — the hand-written `<Modal transparent>` sheets on the
 * search filters, the check-in and the time picker:
 *   - put an unnamed `Pressable` behind the sheet, so VoiceOver/TalkBack read
 *     "button" and nothing else;
 *   - had inputs named only by their placeholder;
 *   - slid in whatever the reduced-motion setting said;
 *   - left the check-in note under the keyboard (no keyboard avoidance).
 * They all render through the shared `Sheet` now; these specs pin the
 * behaviour, not the component.
 */

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), dismissTo: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))
jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ status: 'user', session: { kind: 'user', userId: 'user-1' } }),
}))
jest.mock('@/shared/analytics', () => ({ track: jest.fn() }))
jest.mock('expo-image', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Image: require('react-native').Image,
}))
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: false })),
  launchImageLibraryAsync: jest.fn(),
}))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useTaxonomies: () => mockLoaded({ kinds: { category: [] } }),
  usePlaceSearch: () => ({
    ...mockLoaded({ pages: [{ results: [] }] }),
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: jest.fn(),
  }),
  useSaved: () => mockLoaded([]),
  useToggleSaved: () => ({ mutate: jest.fn() }),
  useAddRoomSeedPlaces: () => ({ mutate: jest.fn() }),
  useUploadImage: () => ({ mutateAsync: jest.fn() }),
}))

import { CheckinSheet } from '@/features/active-date/checkin-sheet.view'
import CreateTimeScreen from '@/features/create-date/create-time.view'
import SearchScreen from '@/features/search/search.view'
import type { PlanStopRow } from '@/shared/api'
import { useRoomStore } from '@/shared/store/roomStore'

type Instance = ReturnType<typeof screen.getByText>

function ancestors(node: Instance): Instance[] {
  const out: Instance[] = []
  for (let current = node.parent; current; current = current.parent) out.push(current as Instance)
  return out
}

function flat(node: Instance): Record<string, unknown> {
  return (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, unknown>
}

/** The Modal a node renders in — React Native's jest mock keeps its props. */
function modalOf(node: Instance): Instance {
  const modal = ancestors(node).find(entry => entry.type === 'Modal')
  if (!modal) throw new Error('not rendered in a Modal')
  return modal
}

/** Any ancestor moved along Y — a slide still in progress or about to start. */
function translatedY(node: Instance): number[] {
  return ancestors(node)
    .map(entry => flat(entry).transform)
    .filter((transform): transform is Record<string, number>[] => Array.isArray(transform))
    .flatMap(transform => transform.map(step => step.translateY).filter(value => typeof value === 'number' && value !== 0))
}

/** Renders, then lets the reduced-motion answer (a promise) land inside act. */
async function renderScreen(element: Parameters<typeof renderBare>[0]) {
  const view = await renderBare(element)
  await act(async () => {})
  return view
}

async function press(element: Instance) {
  await act(async () => {
    await fireEvent.press(element)
  })
}

async function withReducedMotion(reduced: boolean) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduced)
}

const STOP = { id: 'stop-1', placeId: 'place-1' } as unknown as PlanStopRow

beforeEach(() => {
  jest.restoreAllMocks()
  useRoomStore.getState().resetDraft()
})

describe('search filters sheet', () => {
  async function openFilters() {
    const view = await renderScreen(<SearchScreen />)
    await press(view.getByRole('button', { name: 'Bộ lọc' }))
    return view
  }

  it('names the search field, not just its placeholder', async () => {
    const view = await renderScreen(<SearchScreen />)
    expect(view.getByLabelText('Tìm địa điểm')).toBeTruthy()
  })

  it('names the backdrop and every filter input', async () => {
    useRoomStore.setState({ originLat: 10.77, originLng: 106.7 })
    const view = await openFilters()
    expect(view.getByRole('button', { name: 'Đóng' })).toBeTruthy()
    expect(view.getByLabelText('Khoảng cách tối đa (km)')).toBeTruthy()
    expect(view.getByLabelText('Giá từ (nghìn đồng / người)')).toBeTruthy()
    expect(view.getByLabelText('Giá đến (nghìn đồng / người)')).toBeTruthy()
  })

  it('closes from the named backdrop', async () => {
    const view = await openFilters()
    await press(view.getByRole('button', { name: 'Đóng' }))
    expect(view.queryByText('Áp dụng')).toBeNull()
  })

  it('appears without sliding when reduced motion is on', async () => {
    await withReducedMotion(true)
    const view = await openFilters()
    const title = view.getByText('Áp dụng')
    expect(modalOf(title).props.animationType).not.toBe('slide')
    expect(translatedY(title)).toEqual([])
  })
})

describe('check-in sheet', () => {
  async function renderCheckin() {
    const view = await renderScreen(
      <CheckinSheet visible stop={STOP} placeName="Cafe A" onSave={async () => true} onSkip={jest.fn()} />,
    )
    return view
  }

  it('names the backdrop and the note field', async () => {
    const view = await renderCheckin()
    expect(view.getByRole('button', { name: 'Đóng' })).toBeTruthy()
    expect(view.getByLabelText('Ghi chú')).toBeTruthy()
  })

  it('lifts the note field above the keyboard', async () => {
    const view = await renderCheckin()
    const note = view.getByPlaceholderText('Cảm nhận nhanh… (không bắt buộc)')
    // The sheet fills an 844pt window; layout is what a device would report.
    for (const node of ancestors(note)) {
      if (typeof node.props.onLayout === 'function') {
        await act(async () => {
          await fireEvent(node, 'layout', {
            persist: () => {},
            nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
          })
        })
      }
    }
    const KEYBOARD = 300
    await act(async () => {
      DeviceEventEmitter.emit('keyboardWillShow', {
        duration: 0,
        easing: 'keyboard',
        startCoordinates: { screenX: 0, screenY: 844, width: 390, height: KEYBOARD },
        endCoordinates: { screenX: 0, screenY: 844 - KEYBOARD, width: 390, height: KEYBOARD },
        isEventFromThisApp: true,
      })
    })
    const lifted = Math.max(0, ...ancestors(note).map(node => Number(flat(node).paddingBottom ?? 0)))
    expect(lifted).toBeGreaterThanOrEqual(KEYBOARD)
  })
})

describe('time picker sheet', () => {
  it('names the backdrop and appears without sliding when reduced motion is on', async () => {
    await withReducedMotion(true)
    const view = await renderScreen(<CreateTimeScreen />)
    await press(view.getByText('Bắt đầu *'))
    const slot = view.getByText('19:00')
    // The wizard has its own "Đóng"; the backdrop is the one inside the sheet.
    expect(within(modalOf(slot)).getByRole('button', { name: 'Đóng' })).toBeTruthy()
    expect(modalOf(slot).props.animationType).not.toBe('slide')
    expect(translatedY(slot)).toEqual([])
  })
})
