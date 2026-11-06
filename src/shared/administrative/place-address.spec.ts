import { formatPlaceAddress, type PlaceAddress } from './place-address'

const province = 'Thành phố Hà Nội'
const areaSummary = { label: 'Hoàn Kiếm', communeCode: '00001', provinceCode: '01' }

describe('formatPlaceAddress', () => {
  it.each([
    ['8 P. Chân Cầm, Hoàn Kiếm, Hà Nội 100000', 'Hoàn Kiếm', '8 P. Chân Cầm, Hoàn Kiếm, Hà Nội'],
    ['24 P. Đường Thành, Phố cổ Hà Nội, Hoàn Kiếm, Hà Nội 100000', 'Hoàn Kiếm', '24 P. Đường Thành, Phố cổ Hà Nội, Hoàn Kiếm, Hà Nội'],
    ['79 P. Lý Nam Đế, phường, Hoàn Kiếm, Hà Nội 100000', 'Hoàn Kiếm', '79 P. Lý Nam Đế, Hoàn Kiếm, Hà Nội'],
    ['43 Tràng Tiền', 'Cửa Nam', '43 Tràng Tiền, Cửa Nam, Hà Nội'],
    ['  8 P. Chân Cầm , , Tầng 2 , HOAN KIEM, bỏ phần sau', 'Hoàn Kiếm', '8 P. Chân Cầm, Tầng 2, Hoàn Kiếm, Hà Nội'],
    ['Hà Nội, 43 Tràng Tiền', 'Cửa Nam', 'Cửa Nam, Hà Nội'],
    ['PHƯỜNG HOÀN KIẾM, 43 Tràng Tiền', 'Hoàn Kiếm', 'Hoàn Kiếm, Hà Nội'],
    ['8 P. Chân Cầm, Phố cổ Hà Nội', 'Hoàn Kiếm', '8 P. Chân Cầm, Phố cổ Hà Nội, Hoàn Kiếm, Hà Nội'],
    ['8 Đường Hoàn Kiếm', 'Hoàn Kiếm', '8 Đường Hoàn Kiếm, Hoàn Kiếm, Hà Nội'],
    [undefined, 'Cửa Nam', 'Cửa Nam, Hà Nội'],
    ['', 'Cửa Nam', 'Cửa Nam, Hà Nội'],
    [' , , ', 'Cửa Nam', 'Cửa Nam, Hà Nội'],
    ['Hoan Kiem', 'Phường Hoàn Kiếm', 'Hoàn Kiếm, Hà Nội'],
    ['8 đường A, Xã Đàn, Hà Nội', 'Phường Xã Đàn', '8 đường A, Xã Đàn, Hà Nội'],
  ])('formats %s with verified ward %s', (addressText, label, expected) => {
    expect(formatPlaceAddress({ addressText, areaSummary: { ...areaSummary, label } }, province)).toBe(expected)
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

  it.each(['1000', '1000000', 'Tầng 1000000', '100000 phố Tràng Tiền', 'Vietnam Coffee'])('retains non-administrative segment %s', segment => {
    expect(formatPlaceAddress({ addressText: `43 Tràng Tiền, ${segment}`, areaSummary }, province))
      .toBe(`43 Tràng Tiền, ${segment}, Hoàn Kiếm, Hà Nội`)
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
