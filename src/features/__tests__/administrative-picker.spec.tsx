import { fireEvent } from '@testing-library/react-native'
import { renderScreen, loaded as mockLoaded } from './harness'
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
