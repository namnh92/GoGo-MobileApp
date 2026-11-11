import { describe, expect, it } from 'vitest'
import { clearPickerScope, draftPickerScope, readPickerScope, savePickerScope } from './picker-scope'

const area = { datasetVersion: 'ds-wizard', provinceCode: '79', provinceName: 'Hồ Chí Minh', communeCode: '26734', communeName: 'Bến Thành' }
const gps = { administrativeArea: null, originLat: 10.77, originLng: 106.7, radiusM: 5000 }

describe('wizard picker scope', () => {
  it.each([area, { ...area, communeCode: null, communeName: null }])('carries the canonical area, excluding any stale GPS fields (%j)', administrativeArea => {
    const scope = draftPickerScope({ ...gps, administrativeArea })
    expect(scope).toEqual({ status: 'ready', source: 'selected_area', area: administrativeArea })
    expect(readPickerScope(savePickerScope(scope!))).toEqual(scope)
  })
  it.each([100, 2000, 5000, 10000, 100000])('preserves GPS coordinates and the exact supported radius %i', radiusM => {
    const scope = draftPickerScope({ ...gps, radiusM })
    expect(scope).toEqual({ status: 'ready', source: 'gps', position: { lat: gps.originLat, lng: gps.originLng }, radiusM })
    expect(readPickerScope(savePickerScope(scope!))).toEqual(scope)
  })
  it.each([null, 0, 99, 100001, NaN, Infinity, 100.5])('rejects an unlimited or unsupported radius rather than substituting (%s)', radiusM => {
    expect(draftPickerScope({ ...gps, radiusM })).toBeNull()
  })
  it.each([{ originLat: null }, { originLng: null }, { originLat: 91 }, { originLng: -181 }])('rejects incomplete/out-of-range device fixes (%j)', patch => {
    expect(draftPickerScope({ ...gps, ...patch })).toBeNull()
  })
  it.each([undefined, '', '{bad', 'null', '[]', JSON.stringify({ status: 'ready', source: 'gps', position: { lat: 10, lng: 106 } }), JSON.stringify({ status: 'ready', source: 'selected_area', area: { ...area, provinceCode: '' } })])('rejects invalid route scope (%s)', value => {
    expect(readPickerScope(value)).toBeNull()
  })
  it('keeps a copy under a random id, expires replaced/closed ids and rejects serialized scopes', () => {
    const scope = draftPickerScope(gps)!
    const id = savePickerScope(scope)
    expect(id).toMatch(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i)
    if (scope.source === 'gps') scope.position.lat = 20
    expect(readPickerScope(id)).toMatchObject({ position: { lat: gps.originLat } })
    expect(readPickerScope(JSON.stringify(scope))).toBeNull()
    const next = savePickerScope(scope)
    expect(next).not.toBe(id)
    expect(readPickerScope(id)).toBeNull()
    clearPickerScope(id)
    expect(readPickerScope(next)).toEqual(scope)
    clearPickerScope(next)
    expect(readPickerScope(next)).toBeNull()
  })
})
