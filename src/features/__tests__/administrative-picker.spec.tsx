import { act, fireEvent } from '@testing-library/react-native'
import { onlineManager } from '@tanstack/react-query'
import { renderScreen, loaded as mockLoaded } from './harness'
import { OFFLINE_SIGNAL_DELAY_MS } from '@/shared/api/queries/use-online-status'
const mockChanged = jest.fn()
const mockVersion = { value: 'v1' }
const mockProvince = { code: '79', fullName: 'Thành phố Hồ Chí Minh', level: 'PROVINCE', isCurrent: true, status: 'ACTIVE' }
const mockCommune = { code: '26734', fullName: 'Phường Thảo Điền', parentCode: '79', level: 'COMMUNE', isCurrent: true, status: 'ACTIVE' }
jest.mock('@/shared/administrative/queries', () => ({
  useAdministrativeVersion: () => mockLoaded({ datasetVersion: mockVersion.value }),
  useAdministrativeUnits: (_version: string, province?: string) => mockLoaded(province ? [mockCommune] : [mockProvince]),
}))
import { AdministrativePicker } from '@/shared/administrative/administrative-picker.view'
const selected = { datasetVersion: 'v1', provinceCode: '01', provinceName: 'Hà Nội', communeCode: '00001', communeName: 'Phường cũ' }
beforeEach(() => { mockChanged.mockClear(); mockVersion.value = 'v1' })
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
  beforeEach(() => { jest.useFakeTimers() })
  afterEach(async () => {
    await act(async () => { onlineManager.setOnline(true) })
    jest.useRealTimers()
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
})
