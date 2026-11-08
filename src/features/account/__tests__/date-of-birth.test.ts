import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  initialBirthdayDate,
  checkTypedDateOfBirth,
  formatDateOfBirth,
  isoToTyped,
  parseIsoDate,
  todayInVietnam,
  typedToIso,
} from '../date-of-birth'

const previousTz = process.env.TZ
afterEach(() => {
  if (previousTz === undefined) delete process.env.TZ
  else process.env.TZ = previousTz
})

describe('date of birth as a calendar date (PROF-APP-006 #217)', () => {
  it('accepts real dates, leap days included, and nothing else', () => {
    expect(parseIsoDate('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 })
    expect(typedToIso('29/02/2024')).toBe('2024-02-29')
    expect(typedToIso('1/5/1990')).toBe('1990-05-01')
    for (const text of ['29/02/2027', '29/02/1900', '31/04/1990', '01/13/1990', '00/01/1990', '01/01/0000', '1990-05-17', '17-05-1990', 'bad', '']) {
      expect(typedToIso(text), text).toBeNull()
    }
    for (const iso of ['2027-02-29', '2026-13-01', '1990-5-17', '1990-05-17T00:00:00Z', null, undefined]) {
      expect(parseIsoDate(iso), String(iso)).toBeNull()
    }
  })

  it('round-trips between the API shape and the typed shape', () => {
    for (const iso of ['1990-05-17', '2024-02-29', '2000-01-01', '0099-12-31']) {
      expect(typedToIso(isoToTyped(iso))).toBe(iso)
    }
    expect(isoToTyped(null)).toBe('')
  })

  it('never shifts the day, whatever the device time zone', () => {
    for (const tz of ['Pacific/Honolulu', 'America/Los_Angeles', 'UTC', 'Asia/Ho_Chi_Minh', 'Pacific/Kiritimati']) {
      process.env.TZ = tz
      expect(formatDateOfBirth('1990-05-17', 'vi'), tz).toBe('17 tháng 5, 1990')
      expect(formatDateOfBirth('1990-05-17', 'en'), tz).toBe('May 17, 1990')
      expect(formatDateOfBirth('2024-02-29', 'vi'), tz).toBe('29 tháng 2, 2024')
      expect(isoToTyped('1990-01-01'), tz).toBe('01/01/1990')
    }
    expect(formatDateOfBirth(null, 'vi')).toBeNull()
    expect(formatDateOfBirth('2027-02-29', 'vi')).toBeNull()
  })

  it('reads the same whatever CLDR the running ICU ships (#410)', () => {
    // CLDR 49 (ICU 79, Node 26) dropped the comma CLDR 48 put in the Vietnamese
    // long date, and a phone's ICU is not the app's. The label is composed from
    // the date's parts, so Intl can be absent entirely and nothing changes.
    const spy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('Intl.DateTimeFormat must not decide the date of birth label')
    })
    try {
      expect(formatDateOfBirth('1990-05-17', 'vi')).toBe('17 tháng 5, 1990')
      expect(formatDateOfBirth('1990-05-17', 'en')).toBe('May 17, 1990')
      expect(formatDateOfBirth('1985-11-03', 'vi')).toBe('3 tháng 11, 1985')
      expect(formatDateOfBirth('2000-01-01', 'en')).toBe('January 1, 2000')
      expect(formatDateOfBirth('2000-12-31', 'en-US')).toBe('December 31, 2000')
    } finally {
      spy.mockRestore()
    }
  })

  it('reads template and month names from one locale, the product default when unknown (#412 F-01)', () => {
    // i18next keeps a bare tag as typed, so `EN` must be resolved once and the
    // same value handed to the template and the month-name table.
    expect(formatDateOfBirth('1990-05-17', 'EN')).toBe('May 17, 1990')
    expect(formatDateOfBirth('1990-05-17', 'en_GB')).toBe('May 17, 1990')
    for (const unknown of ['fr', '', 'constructor', 'vi-VN', undefined as unknown as string]) {
      expect(formatDateOfBirth('1990-05-17', unknown), String(unknown)).toBe('17 tháng 5, 1990')
    }
  })

  it('judges the future in Asia/Ho_Chi_Minh, which turns over at 17:00 UTC', () => {
    expect(todayInVietnam(new Date('2026-09-14T16:59:59.999Z'))).toBe('2026-09-14')
    expect(todayInVietnam(new Date('2026-09-14T17:00:00.000Z'))).toBe('2026-09-15')
    const earlyMorningInHanoi = new Date('2026-09-14T17:30:00.000Z')
    expect(checkTypedDateOfBirth('15/09/2026', earlyMorningInHanoi)).toEqual({ ok: true, iso: '2026-09-15' })
    expect(checkTypedDateOfBirth('16/09/2026', earlyMorningInHanoi)).toEqual({ ok: false, reason: 'future' })
    expect(checkTypedDateOfBirth('29/02/2027', earlyMorningInHanoi)).toEqual({ ok: false, reason: 'invalid' })
  })

  it('is carried only by the owner profile and its patch in the vendored contract', () => {
    const yaml = readFileSync(path.resolve(__dirname, '../../../../openapi/gogo.v1.yaml'), 'utf8').split('\n')
    const carriers = new Set<string>()
    let inSchemas = false
    let schema = '(outside components.schemas)'
    for (const line of yaml) {
      if (line === '  schemas:') inSchemas = true
      else if (/^ {2}\S/.test(line)) inSchemas = false
      const name = /^ {4}([A-Za-z0-9_]+):\s*$/.exec(line)
      if (inSchemas && name) schema = name[1]!
      if (/^\s+dateOfBirth:/.test(line)) carriers.add(inSchemas ? schema : '(outside components.schemas)')
    }
    expect([...carriers].sort()).toEqual(['Me', 'ProfilePatch'])
  })
})

it.each(['UTC', 'America/Los_Angeles', 'Asia/Ho_Chi_Minh'])('initializes birthday from the field in %s', zone => {
  process.env.TZ = zone
  const now = new Date('2026-11-08T12:00:00Z')
  expect(initialBirthdayDate('17/05/1990', now)).toEqual({ year: 1990, month: 5, day: 17 })
  expect(initialBirthdayDate('29/02/2000', now)).toEqual({ year: 2000, month: 2, day: 29 })
  for (const value of ['', 'invalid', '01/01/2099']) {
    const date = initialBirthdayDate(value, now)
    expect(date).toEqual({ year: 2008, month: 1, day: 1 })
    expect(checkTypedDateOfBirth(isoToTyped(`${date.year}-01-01`), now).ok).toBe(true)
  }
})
