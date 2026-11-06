import { foldName } from './snapshot'

export type PlaceAddress = {
  addressText?: string | null
  areaSummary?: {
    label?: string | null
    communeCode?: string | null
    provinceCode?: string | null
  } | null
}

const WARD_PREFIX = /^(?:phường|xã|đặc khu|thị trấn)\s+/i
const PROVINCE_PREFIX = /^(?:thành phố|tỉnh|tp\.)\s+/i
const ADMIN_PREFIX = /^(?:thanh pho|tp\.?|tinh|phuong|xa|dac khu|thi tran|quan|huyen|thi xa)(?:\s+|$)/

function withoutPrefix(value: string): string {
  return value.replace(ADMIN_PREFIX, '').trim()
}

/** Keep through the first segment starting with a house number (or just the first), then append verified names. */
export function formatPlaceAddress(place: PlaceAddress, provinceFullName?: string | null): string {
  const ward = place.areaSummary?.label?.trim()
  const province = provinceFullName?.trim()
  if (!place.areaSummary?.communeCode || !ward || !province) return place.addressText ?? ''

  const names = new Set([ward, province].flatMap(name => {
    const normalized = foldName(name)
    return [normalized, withoutPrefix(normalized)]
  }))
  const segments = (place.addressText ?? '').split(',').map(segment => segment.trim()).filter(Boolean)
  const numbered = segments.findIndex(segment => /^(số\s*)?\d+[a-z]?([\/-][a-z]?\d+[a-z]?)*\b/i.test(segment))
  const street = segments.slice(0, numbered === -1 ? 1 : numbered + 1)
  while (street.length) {
    const normalized = foldName(street[street.length - 1])
    if (!names.has(normalized) && !names.has(withoutPrefix(normalized))) break
    street.pop()
  }
  const parts = [...street, ward.replace(WARD_PREFIX, '').trim(), province.replace(PROVINCE_PREFIX, '').trim()]
  return [...new Set(parts)].join(', ')
}
