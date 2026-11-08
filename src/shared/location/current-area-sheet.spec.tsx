import { act, fireEvent } from '@testing-library/react-native'
import { AccessibilityInfo } from 'react-native'
import { onlineManager } from '@tanstack/react-query'
import { loaded as mockLoaded, pausedOffline as mockPausedOffline, renderScreen } from '@/features/__tests__/harness'
import { scriptedTime } from '@/features/__tests__/scripted-time'
import { OFFLINE_SIGNAL_DELAY_MS } from '@/shared/api/queries/use-online-status'
import { useAppAreaStore } from './app-area'
import { CurrentAreaSheet } from './current-area-sheet.view'

const province = { code: '79', fullName: 'Thành phố Hồ Chí Minh', level: 'PROVINCE', isCurrent: true, status: 'ACTIVE' }
const commune = { code: '26734', fullName: 'Phường Thảo Điền', parentCode: '79', level: 'COMMUNE', isCurrent: true, status: 'ACTIVE' }
const area = { datasetVersion: 'v1', provinceCode: '79', provinceName: province.fullName, communeCode: null, communeName: null }
const mockState = { version: 'v1', status: 'ready', units: 'ready', empty: false }
const mockRetry = jest.fn()
jest.mock('@/shared/administrative/queries', () => ({
  useAdministrativeVersion: () => mockState.status === 'offline' ? mockPausedOffline() : mockState.status === 'loading' ? { ...mockLoaded(undefined), isPending: true } : mockState.status === 'error' ? { ...mockLoaded(undefined), isError: true, error: new Error('lookup failed'), refetch: mockRetry } : mockLoaded({ datasetVersion: mockState.version }),
  useAdministrativeUnits: (_version: string, parent?: string) => mockState.units === 'offline' ? mockPausedOffline() : mockState.units === 'loading' ? { ...mockLoaded(undefined), isPending: true } : mockState.units === 'error' ? { ...mockLoaded(undefined), isError: true, error: new Error('units failed'), refetch: mockRetry } : mockLoaded(mockState.empty ? [] : parent ? [commune] : [province]),
}))
scriptedTime()
const close = jest.fn()
const applied = jest.fn()
beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)
  mockState.version = 'v1'; mockState.status = 'ready'; mockState.units = 'ready'; mockState.empty = false
  close.mockClear(); applied.mockClear(); mockRetry.mockClear()
  useAppAreaStore.setState({ area: null, manual: false, location: { status: 'idle' }, scope: { status: 'ready', source: 'none', reason: 'no_area' } })
})
afterEach(async () => { await act(async () => onlineManager.setOnline(true)); jest.restoreAllMocks() })
const sheet = () => <CurrentAreaSheet visible onClose={close} onApplied={applied} />

it('uses one sheet for dependent choices, commits canonical API codes only on confirm', async () => {
  const view = await renderScreen(sheet())
  expect(view.getByRole('button', { name: 'Xác nhận' })).toBeDisabled()
  expect(view.getByRole('button', { name: 'Chọn phường / xã' })).toBeDisabled()
  expect(view.getByText('Vui lòng chọn tỉnh / thành phố trước')).toBeTruthy()
  await fireEvent.press(view.getByText('Chọn tỉnh / thành phố'))
  expect(view.getAllByTestId('sheet-drag-handle')).toHaveLength(1)
  await fireEvent.press(view.getByText(province.fullName))
  expect(view.queryByText('Vui lòng chọn tỉnh / thành phố trước')).toBeNull()
  expect(useAppAreaStore.getState().area).toBeNull()
  await fireEvent.press(view.getByText('Chọn phường / xã'))
  await fireEvent.changeText(view.getByLabelText('Tìm theo tên'), 'thao dien')
  await fireEvent.press(view.getByText(commune.fullName))
  await fireEvent.press(view.getByText('Xác nhận'))
  expect(useAppAreaStore.getState()).toMatchObject({ manual: true, area: { ...area, communeCode: commune.code, communeName: commune.fullName } })
  expect(close).toHaveBeenCalledTimes(1)
  expect(applied).toHaveBeenCalledTimes(1)
})

it('clears the persisted selection and disables confirmation after clearing', async () => {
  useAppAreaStore.getState().setArea(area)
  const view = await renderScreen(sheet())
  await fireEvent.press(view.getByText('Xóa khu vực'))
  expect(useAppAreaStore.getState().area).toBeNull()
  expect(view.getByRole('button', { name: 'Xác nhận' })).toBeDisabled()
  expect(view.getByText('Chọn tỉnh / thành phố')).toBeTruthy()
})

it('does not confirm a replaced dataset until a province is selected again', async () => {
  useAppAreaStore.getState().setArea(area)
  mockState.version = 'v2'
  const view = await renderScreen(sheet())
  expect(view.getByRole('button', { name: 'Xác nhận' })).toBeDisabled()
  await fireEvent.press(view.getByText(province.fullName))
  await fireEvent.press(view.getByText(province.fullName))
  await fireEvent.press(view.getByText('Xác nhận'))
  expect(useAppAreaStore.getState().area?.datasetVersion).toBe('v2')
})

it.each(['loading', 'error', 'offline'])('keeps confirmation unavailable during %s without dataset data', async status => {
  useAppAreaStore.getState().setArea(area)
  mockState.status = status
  if (status === 'offline') onlineManager.setOnline(false)
  const view = await renderScreen(sheet())
  await act(async () => { jest.advanceTimersByTime(OFFLINE_SIGNAL_DELAY_MS) })
  expect(view.getByRole('button', { name: 'Xác nhận' })).toBeDisabled()
  if (status === 'loading') expect(view.getByText('Đang tải…')).toBeTruthy()
  if (status === 'offline') expect(view.getByText('Không có kết nối')).toBeTruthy()
  if (status === 'error') { await fireEvent.press(view.getByText('Thử lại')); expect(mockRetry).toHaveBeenCalledTimes(1) }
})

it('renders the empty API list and returns without changing the current area', async () => {
  mockState.empty = true
  const view = await renderScreen(sheet())
  await fireEvent.press(view.getByText('Chọn tỉnh / thành phố'))
  expect(view.getByText('Không có đơn vị phù hợp')).toBeTruthy()
  expect(useAppAreaStore.getState().area).toBeNull()
})


it.each(['loading', 'error', 'offline'])('handles an uncached unit list during %s', async status => {
  mockState.units = status
  if (status === 'offline') onlineManager.setOnline(false)
  const view = await renderScreen(sheet())
  await fireEvent.press(view.getByText('Chọn tỉnh / thành phố'))
  await act(async () => { jest.advanceTimersByTime(OFFLINE_SIGNAL_DELAY_MS) })
  if (status === 'loading') expect(view.getByText('Đang tải…')).toBeTruthy()
  if (status === 'offline') expect(view.getByText('Không có kết nối')).toBeTruthy()
  if (status === 'error') { await fireEvent.press(view.getByText('Thử lại')); expect(mockRetry).toHaveBeenCalledTimes(1) }
  expect(useAppAreaStore.getState().area).toBeNull()
})

it('selects from cached administrative data while offline', async () => {
  onlineManager.setOnline(false)
  const view = await renderScreen(sheet())
  await fireEvent.press(view.getByText('Chọn tỉnh / thành phố'))
  await fireEvent.press(view.getByText(province.fullName))
  await fireEvent.press(view.getByText('Xác nhận'))
  expect(useAppAreaStore.getState().area).toEqual(area)
})


it('applies a controlled profile selection without changing the app-wide area', async () => {
  const apply = jest.fn()
  const view = await renderScreen(<CurrentAreaSheet visible onClose={close} onApplied={applied}
    selection={{ value: null, onApply: apply }} />)
  expect(view.queryByText('Dùng vị trí của tôi')).toBeNull()
  await fireEvent.press(view.getByText('Chọn tỉnh / thành phố'))
  await fireEvent.press(view.getByText(province.fullName))
  expect(apply).not.toHaveBeenCalled()
  expect(useAppAreaStore.getState().area).toBeNull()
  await fireEvent.press(view.getByText('Xác nhận'))
  expect(apply).toHaveBeenCalledWith(area)
  expect(useAppAreaStore.getState().area).toBeNull()
})
