import { act, fireEvent } from '@testing-library/react-native'
import { onlineManager } from '@tanstack/react-query'
import { renderScreen, loaded as mockLoaded, pausedOffline as mockPausedOffline } from './harness'
import { scriptedTime } from './scripted-time'
import { OFFLINE_SIGNAL_DELAY_MS } from '@/shared/api/queries/use-online-status'
const mockChanged = jest.fn()
const mockVersion = { value: 'v1', offline: false }
const mockUnits = { offline: false }
const mockProvince = { code: '79', fullName: 'Thành phố Hồ Chí Minh', level: 'PROVINCE', isCurrent: true, status: 'ACTIVE' }
const mockCommune = { code: '26734', fullName: 'Phường Thảo Điền', parentCode: '79', level: 'COMMUNE', isCurrent: true, status: 'ACTIVE' }
jest.mock('@/shared/administrative/queries', () => ({
  useAdministrativeVersion: () => mockVersion.offline ? mockPausedOffline() : mockLoaded({ datasetVersion: mockVersion.value }),
  useAdministrativeUnits: (_version: string, province?: string) =>
    mockUnits.offline ? mockPausedOffline() : mockLoaded(province ? [mockCommune] : [mockProvince]),
}))
import { AdministrativePicker } from '@/shared/administrative/administrative-picker.view'
const selected = { datasetVersion: 'v1', provinceCode: '01', provinceName: 'Hà Nội', communeCode: '00001', communeName: 'Phường cũ' }
scriptedTime()
beforeEach(() => { mockChanged.mockClear(); mockVersion.value = 'v1'; mockVersion.offline = false; mockUnits.offline = false })
it('changing province clears the old commune and stores canonical codes/version', async () => {
  const view = await renderScreen(<AdministrativePicker value={selected} onChange={mockChanged} />)
  await fireEvent.press(view.getByText('Hà Nội'))
  await fireEvent.press(view.getByText(mockProvince.fullName))
  expect(mockChanged).toHaveBeenCalledWith({ datasetVersion: 'v1', provinceCode: '79', provinceName: mockProvince.fullName, communeCode: null, communeName: null })
})
it('searches and selects the commune within its province', async () => {
  const view = await renderScreen(<AdministrativePicker value={{ ...selected, provinceCode: '79', communeCode: null, communeName: null }} onChange={mockChanged} />)
  await fireEvent.press(view.getByText('Toàn tỉnh/thành phố'))
  await fireEvent.changeText(view.getByLabelText('Tìm theo tên'), 'thao dien')
  await fireEvent.press(view.getByText(mockCommune.fullName))
  expect(mockChanged).toHaveBeenCalledWith(expect.objectContaining({ provinceCode: '79', communeCode: '26734', datasetVersion: 'v1' }))
})
it('requires reselection after a dataset change without silently remapping', async () => {
  mockVersion.value = 'v2'
  const view = await renderScreen(<AdministrativePicker value={selected} onChange={mockChanged} />)
  expect(view.getByText('Dữ liệu hành chính đã thay đổi. Hãy chọn lại tỉnh và phường/xã.')).toBeTruthy()
  await fireEvent.press(view.getByText('Phường cũ'))
  expect(mockChanged).not.toHaveBeenCalled()
})

/**
 * GoGo-MobileApp#253 — the picker lives on forms (create location, profile
 * defaults). Offline it must not tell the user their form is a copy saved on
 * the device, on the form or in its modal.
 */
describe('picker × connectivity', () => {
  afterEach(async () => {
    await act(async () => { onlineManager.setOnline(true) })
  })

  it('claims no saved copy on the form or in the modal while offline', async () => {
    onlineManager.setOnline(false)
    const view = await renderScreen(<AdministrativePicker value={selected} onChange={mockChanged} />)
    await act(async () => { jest.advanceTimersByTime(OFFLINE_SIGNAL_DELAY_MS) })
    expect(view.queryByText(/bản đã lưu trên máy/)).toBeNull()

    await fireEvent.press(view.getByText('Hà Nội'))
    expect(view.getByText(mockProvince.fullName)).toBeTruthy()
    expect(view.queryByText(/bản đã lưu trên máy/)).toBeNull()
  })

  /**
   * GoGo-MobileApp#148 — first use offline: nothing cached, the queries stay
   * pending + paused. The picker must say it is offline, not load forever.
   */
  it('says offline instead of loading forever when no dataset version is cached', async () => {
    mockVersion.offline = true
    onlineManager.setOnline(false)
    const view = await renderScreen(<AdministrativePicker value={null} onChange={mockChanged} />)
    await act(async () => { jest.advanceTimersByTime(OFFLINE_SIGNAL_DELAY_MS) })
    expect(view.getByText('Không có kết nối')).toBeTruthy()
    expect(view.queryByText('Đang tải…')).toBeNull()
    expect(mockChanged).not.toHaveBeenCalled()
  })

  it('says offline in the modal when the unit list was never cached', async () => {
    mockUnits.offline = true
    onlineManager.setOnline(false)
    const view = await renderScreen(<AdministrativePicker value={selected} onChange={mockChanged} />)
    await act(async () => { jest.advanceTimersByTime(OFFLINE_SIGNAL_DELAY_MS) })
    await fireEvent.press(view.getByText('Hà Nội'))
    expect(view.getByText('Không có kết nối')).toBeTruthy()
    expect(view.queryByText('Đang tải…')).toBeNull()
  })

  it('still shows loading while online and fetching', async () => {
    mockVersion.offline = true
    const view = await renderScreen(<AdministrativePicker value={null} onChange={mockChanged} />)
    await act(async () => { jest.advanceTimersByTime(OFFLINE_SIGNAL_DELAY_MS) })
    expect(view.queryByText('Không có kết nối')).toBeNull()
    expect(view.getByText('Đang tải…')).toBeTruthy()
  })
})

// Both modes live inside a native sheet: embedded reuses the area-picker sheet.
it.each([false, true])('has no notification navigation while choosing administrative units (embedded=%s)', async embedded => {
  const view = await renderScreen(<AdministrativePicker embedded={embedded} value={selected} onChange={mockChanged} />)
  await fireEvent.press(view.getByText('Hà Nội'))
  expect(view.getByRole('header', { name: 'Tỉnh/thành phố' })).toBeTruthy()
  expect(view.queryByTestId('app-header-bell')).toBeNull()
  await fireEvent.press(view.getByText(mockProvince.fullName))
  expect(mockChanged).toHaveBeenCalledTimes(1)
})

/**
 * The province-wide choice is the first row of the commune list (owner,
 * 2026-11-12): the same row as a commune, named after the province, and the
 * chosen row carries `selected` plus a check glyph.
 */
describe('commune list × province-wide row', () => {
  const inProvince = { ...selected, provinceCode: '79', provinceName: mockProvince.fullName }
  const rowName = `Toàn ${mockProvince.fullName}`
  const unitRows = (view: Awaited<ReturnType<typeof renderScreen>>, names: string[]) =>
    view.getAllByRole('button').filter(row => names.includes(row.props.accessibilityLabel))

  it('renders the province-wide row first, named after the province', async () => {
    const view = await renderScreen(<AdministrativePicker value={{ ...inProvince, communeCode: null, communeName: null }} onChange={mockChanged} />)
    await fireEvent.press(view.getByText('Toàn tỉnh/thành phố'))
    expect(unitRows(view, [rowName, mockCommune.fullName]).map(row => row.props.accessibilityLabel)).toEqual([rowName, mockCommune.fullName])
  })

  it('selecting it clears the commune and keeps the province, as before', async () => {
    const value = { ...inProvince, communeCode: '26734', communeName: mockCommune.fullName }
    const view = await renderScreen(<AdministrativePicker value={value} onChange={mockChanged} />)
    await fireEvent.press(view.getByText(mockCommune.fullName))
    await fireEvent.press(view.getByRole('button', { name: rowName }))
    expect(mockChanged).toHaveBeenCalledTimes(1)
    expect(mockChanged).toHaveBeenCalledWith({ ...value, communeCode: null, communeName: null })
  })

  it('marks the province-wide row selected when no commune is chosen', async () => {
    const view = await renderScreen(<AdministrativePicker value={{ ...inProvince, communeCode: null, communeName: null }} onChange={mockChanged} />)
    await fireEvent.press(view.getByText('Toàn tỉnh/thành phố'))
    expect(view.getByRole('button', { name: rowName }).props.accessibilityState).toEqual({ selected: true })
    expect(view.getByRole('button', { name: mockCommune.fullName }).props.accessibilityState).toEqual({ selected: false })
  })

  it('marks the chosen commune selected instead', async () => {
    const view = await renderScreen(<AdministrativePicker value={{ ...inProvince, communeCode: '26734', communeName: mockCommune.fullName }} onChange={mockChanged} />)
    await fireEvent.press(view.getByText(mockCommune.fullName))
    const [, communeRow] = unitRows(view, [mockCommune.fullName])
    expect(view.getByRole('button', { name: rowName }).props.accessibilityState).toEqual({ selected: false })
    expect(communeRow.props.accessibilityState).toEqual({ selected: true })
  })

  it('falls back to the generic label without a province name and hides on a non-matching search', async () => {
    const view = await renderScreen(<AdministrativePicker value={{ ...inProvince, provinceName: '', communeCode: null, communeName: null }} onChange={mockChanged} />)
    await fireEvent.press(view.getByText('Toàn tỉnh/thành phố'))
    // The closed commune field keeps its own label behind the sheet.
    expect(unitRows(view, ['Toàn tỉnh/thành phố'])).toHaveLength(2)
    await fireEvent.changeText(view.getByLabelText('Tìm theo tên'), 'thao dien')
    expect(unitRows(view, ['Toàn tỉnh/thành phố'])).toHaveLength(1)
    expect(view.getByText(mockCommune.fullName)).toBeTruthy()
  })
})
