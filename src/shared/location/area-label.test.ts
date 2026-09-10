import { describe, expect, it } from 'vitest'

import { areaLabelFrom, serviceAreaLabel } from './area-label'

/**
 * APP-039 (#193) — curated names already carry their city, so the old rule
 * ("append unless city === name") produced "Quận 1, TP.HCM, TP.HCM" on the
 * account screen and on the wizard's prefill chip.
 */
describe('serviceAreaLabel', () => {
  it('does not repeat a city the name already carries', () => {
    expect(serviceAreaLabel({ name: 'Quận 1, TP.HCM', city: 'TP.HCM' })).toBe('Quận 1, TP.HCM')
    expect(serviceAreaLabel({ name: 'Hoàn Kiếm, Hà Nội', city: 'Hà Nội' })).toBe('Hoàn Kiếm, Hà Nội')
  })

  it('adds the city when the name does not name it', () => {
    expect(serviceAreaLabel({ name: 'Thảo Điền', city: 'TP.HCM' })).toBe('Thảo Điền, TP.HCM')
  })

  it('leaves a name alone when the area is its own city', () => {
    expect(serviceAreaLabel({ name: 'TP. Thủ Đức', city: null })).toBe('TP. Thủ Đức')
    expect(serviceAreaLabel({ name: 'Đà Nẵng', city: 'Đà Nẵng' })).toBe('Đà Nẵng')
  })

  it('ignores whitespace around a city and matches whole segments only', () => {
    expect(serviceAreaLabel({ name: 'Quận 1, TP.HCM', city: '  TP.HCM  ' })).toBe('Quận 1, TP.HCM')
    // "Hà" is not a segment of "Hà Nội", so it is still appended.
    expect(serviceAreaLabel({ name: 'Hoàn Kiếm, Hà Nội', city: 'Hà' })).toBe('Hoàn Kiếm, Hà Nội, Hà')
  })
})

describe('areaLabelFrom', () => {
  it('still drops a district repeated as its own city', () => {
    expect(areaLabelFrom({ district: 'An Khanh', city: 'An Khanh' })).toBe('An Khanh')
  })
})
