import { describe, expect, it } from 'vitest'
import { emptyFilters, filterParams, validateFilters } from './discovery-filters'
import { toPlaceCard } from '@/shared/api/view-models'
import { discoveryLabels } from '@/shared/api/discovery-taxonomies'
import type { OpResponse, PlaceSearchResult } from '@/shared/api/types'

describe('#774 server facts', () => {
  it('serializes ALL amenities and OR mood/setting/suitability without client expansions', () => {
    expect(filterParams({ ...emptyFilters(), amenities: ['wifi', 'power_outlets', 'wifi', 'cashless_payment'], moods: ['chill', 'cozy'], settings: ['indoor'], suited: ['couple', 'work_reading'] })).toEqual({ amenities: 'wifi,power_outlets,cashless_payment', moods: 'chill,cozy', settings: 'indoor', suitedFor: 'couple,work_reading' })
  })
  it('rejects more than ten distinct keys per dimension', () => {
    expect(validateFilters({ ...emptyFilters(), moods: Array.from({ length: 11 }, (_, i) => String(i)) })).toBe(false)
  })
  it('maps explicit verification and administrative label; uses taxonomy server labels only', () => {
    const result = { id: 'p', name: 'Venue', verification: { status: 'verified' }, areaSummary: { label: 'Huế' }, taxonomies: [{ kind: 'mood', key: 'cozy' }, { kind: 'amenity', key: 'unknown' }] } as PlaceSearchResult
    expect(toPlaceCard(result, { mood: { cozy: 'Ấm cúng' } }).discovery).toEqual({ verified: true, areaLabel: 'Huế', tagLabels: ['Ấm cúng'] })
    expect(toPlaceCard({ id: 'old', confidence: 1 } as PlaceSearchResult).discovery).toBeUndefined()
  })
  it('accepts amenity and future taxonomy kinds, omitting tags without server labels', () => {
    const labels = discoveryLabels({ kinds: {
      amenity: [{ key: 'wifi', labels: { vi: 'Wi-Fi' } }],
      future_kind: [{ key: 'new_key', labels: { vi: 'Nhãn mới' } }],
    } } satisfies OpResponse<'listTaxonomies'>, 'vi-VN')
    // Model a newer server response crossing the generated contract boundary.
    const result = { id: 'p', name: 'Venue', taxonomies: [
      { kind: 'amenity', key: 'wifi' },
      { kind: 'future_kind', key: 'new_key' },
      { kind: 'unrecognised_kind', key: 'unlabelled' },
    ] } as unknown as PlaceSearchResult
    expect(toPlaceCard(result, labels).discovery?.tagLabels).toEqual(['Wi-Fi', 'Nhãn mới'])
    expect(toPlaceCard(result).discovery?.tagLabels).toEqual([])
    expect(discoveryLabels(undefined, 'vi')).toEqual({})
  })
})
