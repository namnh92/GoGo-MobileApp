import { describe, expect, it } from 'vitest'

import { enMessages } from '@/shared/i18n/en'
import { viMessages } from '@/shared/i18n/vi'

import { SETTINGS_ROWS } from '../profile-settings-rows'

describe('profile settings rows (APP-058, #216)', () => {
  it('reaches notifications and location through one row', () => {
    const routes = SETTINGS_ROWS.map(row => row.route)
    expect(routes.filter(route => route === '/settings/notifications')).toHaveLength(1)
    expect(routes).not.toContain('/settings/location')
    expect(SETTINGS_ROWS.map(row => row.key)).toEqual(['inbox', 'notificationsLocation', 'reviews', 'account'])
  })

  it('labels every row in both languages', () => {
    for (const row of SETTINGS_ROWS) {
      const key = `profile.settings.${row.key}`
      expect(Object.keys(viMessages)).toContain(key)
      expect(Object.keys(enMessages)).toContain(key)
    }
  })
})
