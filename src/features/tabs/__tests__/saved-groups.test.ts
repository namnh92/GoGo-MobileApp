import { describe, expect, it } from 'vitest'

import { shouldPersistQuery } from '@/shared/api/persist-policy'

import { compareVietnamese, groupSavedByArea, type AreaFacts, type GroupEntry, type ProvinceGroup } from '../saved-groups'

const commune = (provinceCode: string, provinceName: string, communeCode: string, communeName: string): AreaFacts => ({
  scope: 'commune',
  provinceCode,
  provinceName,
  communeCode,
  communeName,
})
const province = (provinceCode: string, provinceName: string): AreaFacts => ({
  scope: 'province',
  provinceCode,
  provinceName,
  communeCode: null,
  communeName: null,
})
const none = (scope: 'unknown' | 'multiple_provinces'): AreaFacts => ({
  scope,
  provinceCode: null,
  provinceName: null,
  communeCode: null,
  communeName: null,
})
const entry = (key: string, area: AreaFacts): GroupEntry<string> => ({ key, area, value: key })

const HCM_BEN_THANH = commune('79', 'Thành phố Hồ Chí Minh', '26734', 'Phường Bến Thành')
const HCM_SAI_GON = commune('79', 'Thành phố Hồ Chí Minh', '26740', 'Phường Sài Gòn')
const HN_HOAN_KIEM = commune('01', 'Thành phố Hà Nội', '00070', 'Phường Hoàn Kiếm')
const DN_HAI_CHAU = commune('48', 'Thành phố Đà Nẵng', '20194', 'Phường Hải Châu')
const AG_LONG_XUYEN = commune('89', 'Tỉnh An Giang', '30307', 'Phường Long Xuyên')

const ENTRIES = [
  entry('place:ben-thanh', HCM_BEN_THANH),
  entry('place:hoan-kiem', HN_HOAN_KIEM),
  entry('plan:hcm-walk', province('79', 'Thành phố Hồ Chí Minh')),
  entry('place:hai-chau', DN_HAI_CHAU),
  entry('place:sai-gon', HCM_SAI_GON),
  entry('plan:road-trip', none('multiple_provinces')),
  entry('place:unmapped', none('unknown')),
  entry('place:long-xuyen', AG_LONG_XUYEN),
  entry('place:ben-thanh', HCM_BEN_THANH),
  entry('place:ben-thanh-2', HCM_BEN_THANH),
]

const names = (groups: ReturnType<typeof groupSavedByArea<string>>) =>
  groups.map(group =>
    group.kind === 'province'
      ? [group.provinceName, group.communes.map(c => c.communeName ?? '(nhiều xã)')]
      : [group.kind, group.entries.map(e => e.key)],
  )

describe('compareVietnamese', () => {
  it('follows the Vietnamese alphabet rather than code points', () => {
    const words = ['Đà Nẵng', 'Dĩ An', 'Ân Thi', 'Ăn Uống', 'An Giang', 'Bắc Ninh', 'Ba Vì', 'Cà Mau', 'Ơn', 'Ô Môn', 'Ong']
    expect([...words].sort(compareVietnamese)).toEqual([
      'An Giang', 'Ăn Uống', 'Ân Thi', 'Ba Vì', 'Bắc Ninh', 'Cà Mau', 'Dĩ An', 'Đà Nẵng', 'Ong', 'Ô Môn', 'Ơn',
    ])
  })

  it('orders tones after the base letter', () => {
    expect(['bạ', 'bá', 'ba', 'bã', 'bà', 'bả'].sort(compareVietnamese)).toEqual(['ba', 'bà', 'bả', 'bã', 'bá', 'bạ'])
  })

  it('ignores the unit type word', () => {
    expect(['Tỉnh Bắc Ninh', 'Thành phố Cần Thơ', 'Tỉnh An Giang'].sort(compareVietnamese)).toEqual([
      'Tỉnh An Giang', 'Tỉnh Bắc Ninh', 'Thành phố Cần Thơ',
    ])
  })
})

describe('groupSavedByArea', () => {
  it('orders provinces and communes alphabetically, keeps several-commune plans last, and ends with the special groups', () => {
    expect(names(groupSavedByArea(ENTRIES, null))).toEqual([
      ['Tỉnh An Giang', ['Phường Long Xuyên']],
      ['Thành phố Đà Nẵng', ['Phường Hải Châu']],
      ['Thành phố Hà Nội', ['Phường Hoàn Kiếm']],
      ['Thành phố Hồ Chí Minh', ['Phường Bến Thành', 'Phường Sài Gòn', '(nhiều xã)']],
      ['multiple_provinces', ['plan:road-trip']],
      ['unknown', ['place:unmapped']],
    ])
  })

  it('puts the current commune and its province first', () => {
    const groups = groupSavedByArea(ENTRIES, { provinceCode: '79', communeCode: '26740' })
    expect(names(groups).slice(0, 2)).toEqual([
      ['Thành phố Hồ Chí Minh', ['Phường Sài Gòn', 'Phường Bến Thành', '(nhiều xã)']],
      ['Tỉnh An Giang', ['Phường Long Xuyên']],
    ])
    const first = groups[0] as ProvinceGroup<string>
    expect(first.isCurrent).toBe(true)
    expect(first.communes.map(c => c.isCurrent)).toEqual([true, false, false])
  })

  it('puts a whole-province current area first without marking a commune', () => {
    const [first] = groupSavedByArea(ENTRIES, { provinceCode: '01', communeCode: null }) as ProvinceGroup<string>[]
    expect(first!.provinceName).toBe('Thành phố Hà Nội')
    expect(first!.communes.every(c => !c.isCurrent)).toBe(true)
  })

  it('keeps every item exactly once, in the order it came', () => {
    const groups = groupSavedByArea(ENTRIES, null)
    const keys = groups.flatMap(group =>
      group.kind === 'province' ? group.communes.flatMap(c => c.entries.map(e => e.key)) : group.entries.map(e => e.key),
    )
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toHaveLength(new Set(ENTRIES.map(e => e.key)).size)
    const benThanh = (groups[3] as ProvinceGroup<string>).communes[0]!
    expect(benThanh.entries.map(e => e.key)).toEqual(['place:ben-thanh', 'place:ben-thanh-2'])
  })

  it('treats an area without labels as unknown rather than guessing', () => {
    const groups = groupSavedByArea([entry('place:x', { ...HCM_BEN_THANH, communeName: null })], null)
    expect(groups).toEqual([{ key: 'unknown', kind: 'unknown', entries: [entry('place:x', { ...HCM_BEN_THANH, communeName: null })] }])
  })

  it('never persists a located position', () => {
    expect(shouldPersistQuery(['location', 'administrative-area', '10.7700', '106.7000'])).toBe(false)
  })
})
