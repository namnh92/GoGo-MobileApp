import { describe, expect, it } from 'vitest'
import { foldName, loadAdministrativeSnapshot, type AdministrativePage, type AdministrativeUnit } from '../snapshot'
import { shouldPersistQuery } from '@/shared/api/persist-policy'
const unit = (code: string, parentCode?: string): AdministrativeUnit => ({
  code, name: code, fullName: code, parentCode, unitType: parentCode ? 'WARD' : 'PROVINCE',
  level: parentCode ? 'COMMUNE' : 'PROVINCE', status: 'ACTIVE', isCurrent: true, effectiveFrom: '2025-07-01',
})
const page = (items: AdministrativeUnit[], nextCursor: string | null = null, datasetVersion = 'v1'): AdministrativePage => ({
  items, nextCursor, datasetVersion, total: items.length,
})
describe('administrative snapshots', () => {
  it('keeps leading zeros and loads every page exactly once', async () => {
    const result = await loadAdministrativeSnapshot('v1', '01', async cursor =>
      cursor ? page([unit('00002', '01')]) : page([unit('00001', '01')], 'next'))
    expect(result.map(u => u.code)).toEqual(['00001', '00002'])
  })
  it('rejects a dataset swap between pages', async () => {
    await expect(loadAdministrativeSnapshot('v1', undefined, async cursor =>
      cursor ? page([unit('02')], null, 'v2') : page([unit('01')], 'next'))).rejects.toThrow('VERSION_CHANGED')
  })
  it('rejects a commune under the wrong province', async () => {
    await expect(loadAdministrativeSnapshot('v1', '01', async () => page([unit('00001', '02')]))).rejects.toThrow('INVALID_HIERARCHY')
  })
  it('rejects legacy units and noncurrent codes', async () => {
    await expect(loadAdministrativeSnapshot('v1', undefined, async () => page([{ ...unit('01'), isCurrent: false }]))).rejects.toThrow('INVALID_HIERARCHY')
  })
  it('stops a repeated pagination cursor', async () => {
    await expect(loadAdministrativeSnapshot('v1', undefined, async () => page([], 'same'))).rejects.toThrow('REPEATED_CURSOR')
  })
  it('searches Vietnamese names without accents', () => expect(foldName('Phường Thảo Điền')).toContain('thao dien'))
  it('persists versioned public snapshots for offline reuse', () => {
    expect(shouldPersistQuery(['administrative', 'version'])).toBe(true)
    expect(shouldPersistQuery(['administrative', 'v1', '01'])).toBe(true)
  })
})
