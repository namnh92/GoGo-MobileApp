/**
 * ADM-205 (#214) — saved items grouped by canonical area: province, then
 * commune, the user's current area first, the rest in Vietnamese alphabetical
 * order at both levels. Plans spanning several communes sit in their province
 * under "several communes"; plans spanning provinces and items with no known
 * area get their own groups at the end, so nothing is dropped or guessed.
 *
 * The whole saved list comes back in one response, so grouping runs over all
 * of it rather than one page at a time.
 */

export type AreaFacts = {
  scope: 'commune' | 'province' | 'multiple_provinces' | 'unknown'
  provinceCode: string | null
  provinceName: string | null
  communeCode: string | null
  communeName: string | null
}

export type CurrentArea = { provinceCode: string; communeCode: string | null } | null

export type GroupEntry<T> = { key: string; area: AreaFacts; value: T }

export type CommuneGroup<T> = {
  key: string
  kind: 'commune' | 'multiple_communes'
  communeCode: string | null
  communeName: string | null
  isCurrent: boolean
  entries: GroupEntry<T>[]
}

export type ProvinceGroup<T> = {
  key: string
  kind: 'province'
  provinceCode: string
  provinceName: string
  isCurrent: boolean
  communes: CommuneGroup<T>[]
}

export type SpecialGroup<T> = {
  key: 'multiple_provinces' | 'unknown'
  kind: 'multiple_provinces' | 'unknown'
  entries: GroupEntry<T>[]
}

export type SavedGroup<T> = ProvinceGroup<T> | SpecialGroup<T>

// Vietnamese alphabet order, done by hand: `localeCompare('vi')` depends on the
// engine's ICU data, and Hermes builds differ in what they carry.
const LETTERS = 'aăâbcdđeêfghijklmnoôơpqrstuưvwxyz'
// Tones sort after the base letter: ngang, huyền, hỏi, ngã, sắc, nặng.
const TONES: Record<number, number> = { 0x300: 1, 0x309: 2, 0x303: 3, 0x301: 4, 0x323: 5 }
// The unit type word is part of the official name but not of how people look
// a place up: "Tỉnh An Giang" sorts under A, not with every other "Tỉnh".
const TYPE_PREFIX = /^(thành phố|tỉnh|phường|xã|đặc khu|thị trấn)\s+/iu

const isMark = (cp: number) => cp >= 0x300 && cp <= 0x36f

function sortKey(name: string): { primary: number[]; tones: number[] } {
  const chars = Array.from(name.trim().replace(TYPE_PREFIX, '').toLowerCase().normalize('NFD'))
  const primary: number[] = []
  const tones: number[] = []
  for (let i = 0; i < chars.length; i++) {
    let letter = chars[i]!
    if (isMark(letter.codePointAt(0)!)) continue
    let tone = 0
    let next = i + 1
    while (next < chars.length && isMark(chars[next]!.codePointAt(0)!)) {
      const mark = chars[next]!.codePointAt(0)!
      if (mark === 0x306 && letter === 'a') letter = 'ă'
      else if (mark === 0x302 && letter === 'a') letter = 'â'
      else if (mark === 0x302 && letter === 'e') letter = 'ê'
      else if (mark === 0x302 && letter === 'o') letter = 'ô'
      else if (mark === 0x31b && letter === 'o') letter = 'ơ'
      else if (mark === 0x31b && letter === 'u') letter = 'ư'
      else if (TONES[mark] !== undefined) tone = TONES[mark]!
      next++
    }
    i = next - 1
    const index = LETTERS.indexOf(letter)
    if (index >= 0) primary.push(100 + index)
    else if (/\d/.test(letter)) primary.push(10 + Number(letter))
    else if (/\s/.test(letter)) primary.push(1)
    else primary.push(1000 + letter.codePointAt(0)!)
    tones.push(tone)
  }
  return { primary, tones }
}

function compareNumbers(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i]! - b[i]!
  }
  return a.length - b.length
}

export function compareVietnamese(a: string, b: string): number {
  const left = sortKey(a)
  const right = sortKey(b)
  return compareNumbers(left.primary, right.primary) || compareNumbers(left.tones, right.tones)
}

export function groupSavedByArea<T>(entries: readonly GroupEntry<T>[], current: CurrentArea): SavedGroup<T>[] {
  const provinces = new Map<string, ProvinceGroup<T>>()
  const multiple: GroupEntry<T>[] = []
  const unknown: GroupEntry<T>[] = []
  const seen = new Set<string>()

  for (const entry of entries) {
    if (seen.has(entry.key)) continue
    seen.add(entry.key)
    const area = entry.area
    if (area.scope === 'multiple_provinces') {
      multiple.push(entry)
      continue
    }
    const labelled =
      (area.scope === 'commune' && area.provinceCode && area.provinceName && area.communeCode && area.communeName) ||
      (area.scope === 'province' && area.provinceCode && area.provinceName)
    if (!labelled) {
      unknown.push(entry)
      continue
    }
    const provinceCode = area.provinceCode!
    let province = provinces.get(provinceCode)
    if (!province) {
      province = {
        key: `province:${provinceCode}`,
        kind: 'province',
        provinceCode,
        provinceName: area.provinceName!,
        isCurrent: current?.provinceCode === provinceCode,
        communes: [],
      }
      provinces.set(provinceCode, province)
    }
    const communeKey = area.scope === 'commune' ? `commune:${area.communeCode}` : `communes:${provinceCode}`
    let commune = province.communes.find(group => group.key === communeKey)
    if (!commune) {
      commune =
        area.scope === 'commune'
          ? {
              key: communeKey,
              kind: 'commune',
              communeCode: area.communeCode,
              communeName: area.communeName,
              isCurrent: province.isCurrent && current?.communeCode === area.communeCode,
              entries: [],
            }
          : { key: communeKey, kind: 'multiple_communes', communeCode: null, communeName: null, isCurrent: false, entries: [] }
      province.communes.push(commune)
    }
    commune.entries.push(entry)
  }

  const ordered = [...provinces.values()].sort(
    (a, b) =>
      Number(b.isCurrent) - Number(a.isCurrent) ||
      compareVietnamese(a.provinceName, b.provinceName) ||
      a.provinceCode.localeCompare(b.provinceCode),
  )
  for (const province of ordered) {
    province.communes.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'multiple_communes' ? 1 : -1
      return (
        Number(b.isCurrent) - Number(a.isCurrent) ||
        compareVietnamese(a.communeName ?? '', b.communeName ?? '') ||
        (a.communeCode ?? '').localeCompare(b.communeCode ?? '')
      )
    })
  }

  const groups: SavedGroup<T>[] = [...ordered]
  if (multiple.length > 0) groups.push({ key: 'multiple_provinces', kind: 'multiple_provinces', entries: multiple })
  if (unknown.length > 0) groups.push({ key: 'unknown', kind: 'unknown', entries: unknown })
  return groups
}
