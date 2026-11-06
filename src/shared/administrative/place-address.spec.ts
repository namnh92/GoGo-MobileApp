import { formatPlaceAddress, type PlaceAddress } from './place-address'

const province = 'Thành phố Hà Nội'
const areaSummary = { label: 'Hoàn Kiếm', communeCode: '00001', provinceCode: '01' }

describe('formatPlaceAddress', () => {
  it.each([
    ['8 P. Chân Cầm, Hoàn Kiếm, Hà Nội 100000', 'Hoàn Kiếm', '8 P. Chân Cầm, Hoàn Kiếm, Hà Nội'],
    ['24 P. Đường Thành, Phố cổ Hà Nội, Hoàn Kiếm, Hà Nội 100000', 'Hoàn Kiếm', '24 P. Đường Thành, Hoàn Kiếm, Hà Nội'],
    ['79 P. Lý Nam Đế, phường, Hoàn Kiếm, Hà Nội 100000', 'Hoàn Kiếm', '79 P. Lý Nam Đế, Hoàn Kiếm, Hà Nội'],
    ['43 Tràng Tiền', 'Cửa Nam', '43 Tràng Tiền, Cửa Nam, Hà Nội'],
    ['  8 P. Chân Cầm , , Tầng 2 , HOAN KIEM, bỏ phần sau', 'Hoàn Kiếm', '8 P. Chân Cầm, Hoàn Kiếm, Hà Nội'],
    ['Hà Nội, 43 Tràng Tiền', 'Cửa Nam', 'Hà Nội, 43 Tràng Tiền, Cửa Nam, Hà Nội'],
    ['PHƯỜNG HOÀN KIẾM, 43 Tràng Tiền', 'Hoàn Kiếm', 'PHƯỜNG HOÀN KIẾM, 43 Tràng Tiền, Hoàn Kiếm, Hà Nội'],
    ['8 P. Chân Cầm, Phố cổ Hà Nội', 'Hoàn Kiếm', '8 P. Chân Cầm, Hoàn Kiếm, Hà Nội'],
    ['8 Đường Hoàn Kiếm', 'Hoàn Kiếm', '8 Đường Hoàn Kiếm, Hoàn Kiếm, Hà Nội'],
    [undefined, 'Cửa Nam', 'Cửa Nam, Hà Nội'],
    ['', 'Cửa Nam', 'Cửa Nam, Hà Nội'],
    [' , , ', 'Cửa Nam', 'Cửa Nam, Hà Nội'],
    ['Hoan Kiem', 'Phường Hoàn Kiếm', 'Hoàn Kiếm, Hà Nội'],
    ['8 đường A, Xã Đàn, Hà Nội', 'Phường Xã Đàn', '8 đường A, Xã Đàn, Hà Nội'],
    ['Đường Tràng Tiền, Phố cổ Hà Nội, Hoàn Kiếm, Hà Nội', 'Cửa Nam', 'Đường Tràng Tiền, Cửa Nam, Hà Nội'],
    ['HÀ NỘI, Hoàn Kiếm', 'Cửa Nam', 'Cửa Nam, Hà Nội'],
    ['PHUONG HOAN KIEM, Hà Nội', 'Phường Hoàn Kiếm', 'Hoàn Kiếm, Hà Nội'],
    ['Phường 1, địa chỉ cũ', 'Phường 1', '1, Hà Nội'],
  ])('formats %s with verified ward %s', (addressText, label, expected) => {
    expect(formatPlaceAddress({ addressText, areaSummary: { ...areaSummary, label } }, province)).toBe(expected)
  })

  it.each([
    ['12 Nguyễn Huệ, Bến Nghé, Quận 1, Hồ Chí Minh', '12 Nguyễn Huệ, Sài Gòn, Hồ Chí Minh'],
    ['Tòa nhà Bitexco, 2 Hải Triều, Bến Nghé, Quận 1', 'Tòa nhà Bitexco, 2 Hải Triều, Sài Gòn, Hồ Chí Minh'],
    ['  Tòa nhà Bitexco , , 2 Hải Triều , Bến Nghé', 'Tòa nhà Bitexco, 2 Hải Triều, Sài Gòn, Hồ Chí Minh'],
  ])('replaces legacy administrative names in %s', (addressText, expected) => {
    expect(formatPlaceAddress({ addressText, areaSummary: { ...areaSummary, label: 'Phường Sài Gòn' } }, 'Thành phố Hồ Chí Minh')).toBe(expected)
  })

  it.each(['Phường', 'Xã', 'Đặc khu', 'Thị trấn', '  PHƯỜNG  '])('composes short ward names from %s', prefix => {
    for (const wardSegment of ['Cửa Nam', `${prefix} Cửa Nam`]) {
      expect(formatPlaceAddress({
        addressText: `43 Tràng Tiền, ${wardSegment}, discarded`,
        areaSummary: { ...areaSummary, label: `${prefix} Cửa Nam` },
      }, province)).toBe('43 Tràng Tiền, Cửa Nam, Hà Nội')
    }
  })

  it.each(['Thành phố', 'Tỉnh', 'TP.', '  THÀNH PHỐ  '])('composes short province names from %s', prefix => {
    for (const provinceSegment of ['Hà Nội', `${prefix} Hà Nội`]) {
      expect(formatPlaceAddress({
        addressText: `43 Tràng Tiền, ${provinceSegment}, discarded`,
        areaSummary,
      }, `${prefix} Hà Nội`)).toBe('43 Tràng Tiền, Hoàn Kiếm, Hà Nội')
    }
  })

  it.each(['thành phố', 'tp', 'TP.', 'tỉnh', 'phường', 'xã', 'quận', 'huyện', 'thị xã', 'đặc khu', 'thị trấn'])('recognizes exact names with prefix %s', prefix => {
    expect(formatPlaceAddress({ addressText: `43 Tràng Tiền, ${prefix} HA NOI, street after admin`, areaSummary }, province))
      .toBe('43 Tràng Tiền, Hoàn Kiếm, Hà Nội')
    expect(formatPlaceAddress({ addressText: `43 Tràng Tiền, ${prefix} HOAN KIEM, street after admin`, areaSummary }, province))
      .toBe('43 Tràng Tiền, Hoàn Kiếm, Hà Nội')
  })

  it.each(['phường', 'xã', 'quận', 'huyện', 'thị xã', 'đặc khu', 'thị trấn', 'thành phố', 'tỉnh', 'việt nam', 'vietnam', '  PHUONG  '])('cuts from standalone keyword %s', keyword => {
    expect(formatPlaceAddress({ addressText: `43 Tràng Tiền, ${keyword}, discarded`, areaSummary }, province))
      .toBe('43 Tràng Tiền, Hoàn Kiếm, Hà Nội')
  })

  it.each(['Hà Nội 100000', 'Hà Nội 10000', 'Hà Nội100000', 'Hoàn Kiếm 100000', 'Phố cổ Hà Nội 100000', '100000', '10000'])('cuts from postal segment %s', segment => {
    expect(formatPlaceAddress({ addressText: `43 Tràng Tiền, ${segment}, discarded`, areaSummary }, province))
      .toBe('43 Tràng Tiền, Hoàn Kiếm, Hà Nội')
  })

  it.each(['1000', '1000000', 'Tầng 1000000', '100000 phố Tràng Tiền', 'Vietnam Coffee'])('drops segments after the first numbered segment (%s)', segment => {
    expect(formatPlaceAddress({ addressText: `43 Tràng Tiền, ${segment}`, areaSummary }, province))
      .toBe('43 Tràng Tiền, Hoàn Kiếm, Hà Nội')
  })

  it.each([
    [{}, province],
    [{ areaSummary: { ...areaSummary, communeCode: null } }, province],
    [{ areaSummary: { ...areaSummary, label: '' } }, province],
    [{ areaSummary }, undefined],
    [{ areaSummary }, ' '],
  ] as [PlaceAddress, string | undefined][])('returns the original address when verified facts are missing (%j/%s)', (place, provinceName) => {
    expect(formatPlaceAddress({ ...place, addressText: '  raw, Hà Nội 100000  ' }, provinceName)).toBe('  raw, Hà Nội 100000  ')
  })
})
