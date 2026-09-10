/**
 * ADR-0023 — the account screen must name both halves of deletion. It used to
 * promise "permanently deletes your account and personal data" while reviews
 * and contributed photos stayed, which is the one thing this copy cannot say.
 */
import { viMessages } from '@/shared/i18n/vi'
import { enMessages } from '@/shared/i18n/en'

describe('account deletion copy', () => {
  it('never promises that everything is deleted', () => {
    for (const strings of [viMessages, enMessages]) {
      const body = strings['account.deleteBody'] as string
      expect(body).not.toMatch(/vĩnh viễn|Permanently/i)
    }
  })

  it('names what is removed and what stays, in both languages', () => {
    expect(viMessages['account.deleteBody']).toMatch(/thông tin cá nhân/)
    expect(viMessages['account.deleteKept']).toMatch(/Đánh giá và ảnh/)
    expect(enMessages['account.deleteBody']).toMatch(/personal data/i)
    expect(enMessages['account.deleteKept']).toMatch(/Reviews and photos/i)
  })
})
