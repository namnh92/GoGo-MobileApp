import { describe, expect, it } from 'vitest'
import { detailToPlaceCard } from '@/shared/api/view-models'
import type { SavedEntry } from '@/shared/api/queries/use-me'
import { savedDistance, savedGroupPins, savedUnavailable, orderedSavedStops } from '../saved-facts'
import { mapsUrlSchema } from '@/features/place-import/maps-url'

describe('Saved real facts', () => {
  it('keeps area, hours, taxonomy and provider facts without inventing price or labels', () => {
    const detail = { id: 'a', name: 'A', areaSummary: { label: 'Phường A', datasetVersion: 'ds', provinceCode: '79', communeCode: 'a', locale: 'vi' as const }, hours: [{ dayOfWeek: 5, openMinute: 480, closeMinute: 1200 }], taxonomies: [{ kind: 'amenity', key: 'wifi' }, { kind: 'mood', key: 'missing-label' }], providerStatus: { status: 'temporarily_closed', fetchedAt: '2026-11-07T00:00:00Z' } }
    const card = detailToPlaceCard(detail, { amenity: { wifi: 'Wi-Fi' } })
    expect(card.areaSummary).toEqual(detail.areaSummary)
    expect(card.hours).toEqual(detail.hours)
    expect(card.discovery?.tagLabels).toEqual(['Wi-Fi'])
    expect(card.priceMin).toBeNull()
    expect(savedUnavailable(card)).toBe('temporarily_closed')
    expect(savedUnavailable({ ...card, providerStatus: { status: 'unknown', fetchedAt: '' } })).toBeNull()
    expect(savedUnavailable({ ...card, providerStatus: undefined, openNow: false })).toBeNull()
  })
  it('maps only saved places in the supplied group, without plan stops or invalid coordinates', () => {
    const place = detailToPlaceCard({ id: 'a', name: 'A', lat: 10, lng: 106 })
    const entries = [
      { type: 'place', place }, { type: 'plan', plan: { stops: [{ placeId: 'not-saved' }] } },
      { type: 'place', place: { ...place, id: 'bad', lat: NaN } }, { type: 'place' },
    ] as SavedEntry[]
    expect(savedGroupPins(entries)).toEqual([{ id: 'a', title: 'A', lat: 10, lng: 106 }])
  })
  it('omits unknown distance and labels only an actual GPS estimate', () => {
    expect(savedDistance({ lat: 10, lng: 106 }, null)).toBeUndefined()
    expect(savedDistance({ lat: 10, lng: 106 }, { lat: 10.01, lng: 106 })).toBeCloseTo(1111.95, 0)
  })
  it('uses position for the first stop without mutating plan order', () => {
    const stops = [{ position: 2, placeId: 'b', isOptional: false, costScope: 'per_person' as const }, { position: 1, placeId: 'a', isOptional: false, costScope: 'per_person' as const }]
    expect(orderedSavedStops({ stops })[0]?.placeId).toBe('a')
    expect(stops[0]?.placeId).toBe('b')
  })
  it('accepts Google Maps links only and rejects spoofed hosts', () => {
    for (const url of ['https://maps.app.goo.gl/a', 'https://www.google.com/maps/place/a', 'https://goo.gl/maps/a']) expect(mapsUrlSchema.safeParse(url).success).toBe(true)
    for (const url of ['https://tiktok.com/a', 'https://instagram.com/a', 'https://google.com.evil.test/maps/a', 'https://google.com/search?q=a', 'javascript:alert(1)']) expect(mapsUrlSchema.safeParse(url).success).toBe(false)
  })
})
