import { describe, expect, it } from 'vitest'

import { areaLabelFrom } from '../area-label'

/**
 * The permission flow itself is covered by the create-location component spec;
 * this pins the label rule, which decides what a user sees for their own
 * position and is the part most likely to drift.
 */
describe('areaLabelFrom', () => {
  it('reads as an area, coarsest part last', () => {
    expect(areaLabelFrom({ district: 'Thảo Điền', city: 'TP.HCM' })).toBe('Thảo Điền, TP.HCM')
  })

  it('falls back through subregion and region when the finer parts are missing', () => {
    expect(areaLabelFrom({ subregion: 'Quận 3', region: 'TP.HCM' })).toBe('Quận 3, TP.HCM')
  })

  it('keeps whatever single part exists rather than showing nothing', () => {
    expect(areaLabelFrom({ city: 'Đà Nẵng' })).toBe('Đà Nẵng')
  })

  it('returns null when the provider gives nothing usable, so the UI can say so', () => {
    expect(areaLabelFrom({})).toBeNull()
    expect(areaLabelFrom(undefined)).toBeNull()
  })

  it('says a repeated name once', () => {
    // Seen on a real fix: the geocoder returned the same name for district and
    // city, and the row read "An Khanh, An Khanh".
    expect(areaLabelFrom({ district: 'An Khanh', city: 'An Khanh' })).toBe('An Khanh')
  })

  it('ignores a street address the provider may also return', () => {
    // Only the area fields are read; `street`/`name` never reach the label.
    expect(areaLabelFrom({ district: 'Thảo Điền', city: 'TP.HCM', street: '12 Nguyễn Ư Dĩ' } as never)).toBe(
      'Thảo Điền, TP.HCM',
    )
  })
})
