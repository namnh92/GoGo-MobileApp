import { describe, expect, it } from 'vitest'
import { themes } from '../theme'
import { enMessages } from '@/shared/i18n/en'
import { viMessages } from '@/shared/i18n/vi'
import { motion } from '../tokens'

describe('approved group 01 theme and copy', () => {
  it.each(Object.values(themes))('has complete mode-aware redesign roles ($mode)', theme => {
    expect(Object.keys(theme.redesign).sort()).toEqual(Object.keys(themes.orange.redesign).sort())
    expect(Object.values(theme.redesign).every(value => typeof value === 'string' && value.length > 0)).toBe(true)
    expect(theme.redesign.canvas).toBe(theme.mode === 'dark' ? '#181715' : '#FFF8F3')
    expect(theme.redesign.card).toBe(theme.mode === 'dark' ? '#222222' : '#FFFFFF')
    expect(theme.redesign.ink).toBe(theme.mode === 'dark' ? '#E6E6E6' : '#1D1B18')
    expect(theme.redesign.secondary).toBe(theme.mode === 'dark' ? '#CCCCCC' : '#5A413B')
  })
  it('carries exact Stitch motion timings', () => {
    expect([motion.mapReveal, motion.brandReveal, motion.markerBounce, motion.ripple, motion.ambientWarm, motion.ambientCool]).toEqual([350, 450, 400, 600, 8000, 10000])
  })
  it('translates every auth, splash and illustration key in both locales', () => {
    for (const key of Object.keys(viMessages) as (keyof typeof viMessages)[]) {
      if (!/^(auth|onboarding|splash)\./.test(key)) continue
      expect(viMessages[key].trim(), key).not.toBe('')
      expect(enMessages[key].trim(), key).not.toBe('')
    }
    expect(viMessages['onboarding.art.price']).toBe('250.000đ / người')
    expect(viMessages['onboarding.art.match']).toBe('Khớp 98% gu chung của cả hai')
    expect(viMessages['auth.recoveryUnavailable']).toBe('Khôi phục mật khẩu chưa khả dụng.')
  })
})

// N1 changes marketing scope; named places and splash cities remain examples.
it('uses the owner-approved nationwide marketing in both catalogs', () => {
  expect([viMessages['auth.coffeeBody'], viMessages['auth.curation']]).toEqual(['Cùng bạn bè bình chọn địa điểm ăn uống trên khắp Việt Nam', 'Địa điểm GoGo tuyển chọn'])
  expect([enMessages['auth.coffeeBody'], enMessages['auth.curation']]).toEqual(['Vote with friends on places to eat across Vietnam', 'Curated by GoGo'])
  for (const catalog of [viMessages, enMessages]) {
    for (const [key, copy] of Object.entries(catalog)) {
      if (/^(auth|splash|onboarding)\./.test(key) && !key.startsWith('onboarding.art.')) expect(copy).not.toMatch(/Saigon|Sài Gòn/i)
    }
  }
})
