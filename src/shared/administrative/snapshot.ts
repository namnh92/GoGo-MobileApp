import type { components } from '@/shared/api/types'

export type AdministrativeUnit = components['schemas']['AdministrativeUnit']
export type AdministrativePage = components['schemas']['AdministrativeUnitPage']
/** UI draft; API write shapes stay owned by their generated operation types. */
export type AdministrativeSelection = {
  datasetVersion: string
  provinceCode: string
  provinceName: string
  communeCode: string | null
  communeName: string | null
}

/** "Phường X, Thành phố Y", or the province alone for a whole-province area. */
export function administrativeAreaLabel(area: Pick<AdministrativeSelection, 'provinceName' | 'communeName'>): string {
  return area.communeName ? `${area.communeName}, ${area.provinceName}` : area.provinceName
}

export function foldName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLocaleLowerCase('vi').trim()
}

/** Never join pages from two dataset versions or accept a mismatched parent. */
export async function loadAdministrativeSnapshot(
  version: string,
  parentCode: string | undefined,
  load: (cursor?: string) => Promise<AdministrativePage>,
): Promise<AdministrativeUnit[]> {
  const units = new Map<string, AdministrativeUnit>()
  const cursors = new Set<string>()
  let cursor: string | undefined
  do {
    const page = await load(cursor)
    if (page.datasetVersion !== version) throw new Error('ADMINISTRATIVE_VERSION_CHANGED')
    for (const unit of page.items) {
      if (!unit.isCurrent || unit.status !== 'ACTIVE' ||
        unit.level !== (parentCode ? 'COMMUNE' : 'PROVINCE') ||
        (parentCode && unit.parentCode !== parentCode)) throw new Error('ADMINISTRATIVE_INVALID_HIERARCHY')
      units.set(unit.code, unit)
    }
    cursor = page.nextCursor ?? undefined
    if (cursor && cursors.has(cursor)) throw new Error('ADMINISTRATIVE_REPEATED_CURSOR')
    if (cursor) cursors.add(cursor)
  } while (cursor)
  return [...units.values()].sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi') || a.code.localeCompare(b.code))
}
