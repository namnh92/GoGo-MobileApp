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
const ADMIN_ONLY = /^(?:thanh pho|tp\.?|tinh|phuong|xa|dac khu|thi tran|quan|huyen|thi xa|viet nam|vietnam)$/
const POSTAL_CODE = /(^|\D)\d{5,6}$/

function withoutPrefix(value: string): string {
  return value.replace(ADMIN_PREFIX, '').trim()
}

/** Replace the administrative suffix, preserving leading street segments verbatim. */
export function formatPlaceAddress(place: PlaceAddress, provinceFullName?: string | null): string {
  const ward = place.areaSummary?.label?.trim()
  const province = provinceFullName?.trim()
  if (!place.areaSummary?.communeCode || !ward || !province) return place.addressText ?? ''

  const names = new Set([ward, province].flatMap(name => {
    const normalized = foldName(name)
    return [normalized, withoutPrefix(normalized)]
  }))
  const street: string[] = []
  for (const segment of (place.addressText ?? '').split(',')) {
    const value = segment.trim()
    if (!value) continue
    const normalized = foldName(value)
    const withoutPostalCode = normalized.replace(POSTAL_CODE, '$1').trim()
    if (ADMIN_ONLY.test(normalized) || POSTAL_CODE.test(normalized) ||
      names.has(withoutPostalCode) || names.has(withoutPrefix(withoutPostalCode))) break
    street.push(value)
  }
  return [...street, ward.replace(WARD_PREFIX, '').trim(), province.replace(PROVINCE_PREFIX, '').trim()].join(', ')
}
