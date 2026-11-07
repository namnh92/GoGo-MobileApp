import { describe, expect, it } from 'vitest'
import { amenityIcon, collapsedOptions, optionLabel, taxonomyOptions } from './contribution-options'

describe('CMS contribution options', () => {
  it('keeps active API keys in CMS order, preserving response order for ties', () => {
    expect(taxonomyOptions({ kinds: { mood: [
      { key: 'later', sortOrder: 3 }, { key: 'first', sortOrder: 0 },
      { key: 'same', sortOrder: 0 }, { labels: { vi: 'missing key' } },
    ] } }, 'mood').map((o) => o.key)).toEqual(['first', 'same', 'later'])
    expect(taxonomyOptions(undefined, 'mood')).toEqual([])
    const data = { kinds: { mood: [{ key: 'retired', active: false }, { key: 'live', active: true }] } }
    expect(taxonomyOptions(data, 'mood').map((option) => option.key)).toEqual(['live'])
  })
  it('uses API locale labels before any fallback', () => {
    const option = { key: 'new', labels: { en: 'CMS label', vi: 'Nhãn CMS' } }
    expect(optionLabel(option, 'en-US', 'Local label')).toBe('CMS label')
    expect(optionLabel(option, 'vi', 'Local label')).toBe('Nhãn CMS')
    expect(optionLabel(option, 'fr', 'Local label')).toBe('Local label')
  })
  it('keeps selected overflow choices visible and counts only hidden options', () => {
    const options = Array.from({ length: 40 }, (_, i) => ({ key: String(i) }))
    expect(collapsedOptions(options, ['39'], 6).map((o) => o.key)).toEqual(['0', '1', '2', '3', '4', '39'])
    expect(collapsedOptions(options, ['39'], 5)).toHaveLength(5)
  })
  it('uses a generic amenity icon for new CMS keys, including object property names', () => {
    expect(amenityIcon('car_parking')).toBe('parking')
    expect(amenityIcon('new_cms_amenity')).toBe('activity')
    expect(amenityIcon('constructor')).toBe('activity')
  })
})
