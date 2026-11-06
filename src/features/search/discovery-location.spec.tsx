import { act, fireEvent } from '@testing-library/react-native'
import i18n from '@/shared/i18n'
import { renderScreen } from '../__tests__/harness'

const mockApplied = jest.fn()
const mockBack = jest.fn()
const mockPush = jest.fn()
const mockPermission = jest.fn()
const mockPosition = jest.fn()
const mockSession = { status: 'guest' }
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, push: mockPush }) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => mockSession }))
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: () => mockPermission(),
  getCurrentPositionAsync: () => mockPosition(),
  reverseGeocodeAsync: async () => [],
  Accuracy: { Balanced: 3 },
}))
jest.mock('@/shared/administrative/administrative-picker.view', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native')
  return { AdministrativePicker: ({ onChange }: { onChange: (value: unknown) => void }) => React.createElement(Pressable, {
    onPress: () => onChange({ datasetVersion: 'published', provinceCode: 'other-city', provinceName: 'Other city', communeCode: null, communeName: null }),
  }, React.createElement(Text, null, 'Pick another city')) }
})

import { DiscoveryLocationSheet } from './discovery-location.view'
import { useDiscoveryAreaStore } from './discovery-area-store'

beforeEach(() => {
  jest.clearAllMocks()
  useDiscoveryAreaStore.setState({ area: null })
  mockPermission.mockResolvedValue({ status: 'granted' })
  mockPosition.mockResolvedValue({ coords: { latitude: 10.77, longitude: 106.7 } })
})

describe('O-5 public current location', () => {
  it.each(['guest', 'anonymous'])('asks for device permission on tap for %s without sign-in', async status => {
    mockSession.status = status
    useDiscoveryAreaStore.setState({ area: { datasetVersion: 'published', provinceCode: 'other-city', provinceName: 'Other city', communeCode: null, communeName: null } })
    const view = await renderScreen(<DiscoveryLocationSheet onClose={mockBack} onApplied={mockApplied} />)
    expect(mockPermission).not.toHaveBeenCalled()
    await act(async () => { await fireEvent.press(view.getByText('Dùng vị trí hiện tại')) })
    expect(mockPermission).toHaveBeenCalledTimes(1)
    expect(mockPosition).toHaveBeenCalledTimes(1)
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockBack).toHaveBeenCalledTimes(1)
    expect(mockApplied).toHaveBeenCalledTimes(1)
    expect(useDiscoveryAreaStore.getState().area).toBeNull()
  })

  it.each(['denied', 'unavailable'])('keeps the manual picker available after %s', async outcome => {
    if (outcome === 'denied') mockPermission.mockResolvedValue({ status: 'denied' })
    else mockPosition.mockRejectedValue(new Error('unavailable'))
    const view = await renderScreen(<DiscoveryLocationSheet onClose={mockBack} onApplied={mockApplied} />)
    await act(async () => { await fireEvent.press(view.getByText('Dùng vị trí hiện tại')) })
    expect(view.getByText(i18n.t(outcome === 'denied' ? 'createLocation.permissionDenied' : 'createLocation.locationUnavailable'))).toBeTruthy()
    expect(mockBack).not.toHaveBeenCalled()
    await fireEvent.press(view.getByText('Pick another city'))
    expect(useDiscoveryAreaStore.getState().area).toBeNull()
    await fireEvent.press(view.getByText('Dùng khu vực này'))
    expect(useDiscoveryAreaStore.getState().area?.provinceCode).toBe('other-city')
    expect(mockBack).toHaveBeenCalledTimes(1)
    expect(mockApplied).toHaveBeenCalledTimes(1)
  })
})


it('discards an uncommitted area when the close button is pressed', async () => {
  const view = await renderScreen(<DiscoveryLocationSheet onClose={mockBack} onApplied={mockApplied} />)
  await fireEvent.press(view.getByText('Pick another city'))
  await fireEvent.press(view.getAllByLabelText(i18n.t('common.close')).at(-1)!)
  expect(useDiscoveryAreaStore.getState().area).toBeNull()
  expect(mockBack).toHaveBeenCalledTimes(1)
})
