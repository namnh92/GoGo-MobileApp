import { describe, expect, it } from 'vitest'

import { viContent, viMessages } from './vi'

// Product/provider names, place names and technical abbreviations retain case.
const properNames = [
  'GoGo Credit', 'GoGo Room', 'GoGo AI', 'GoGo', 'Google Maps', 'Google',
  'iOS', 'iPhone', 'Android', 'OneSignal', 'Tenjin', 'Adjust', 'App Set ID',
  'IP', 'GPS', 'VND', 'JPG', 'PNG', 'VD',
  'Hà Nội', 'Đà Nẵng', 'Việt Nam', 'Bưu Điện', 'Thảo Trang', 'Minh Quân',
  'Mùa Cà Phê Mộc', "L'Oven Trattoria", 'Thảo Điền', 'The Workshop Cafe',
  'Mộc Riêu', 'Gác Cà Phê & Đĩa Than', 'Minh Anh',
]

function midSentenceCapitals(message: string): string[] {
  let text = message.replace(/\{\{.*?\}\}/g, '')
  for (const name of properNames) text = text.replaceAll(name, name.toLocaleLowerCase('vi'))
  // Exact screen/action titles used as navigation references, not common nouns.
  for (const label of ['Đã lưu', 'Tạo lại kế hoạch']) {
    text = text.replaceAll(`vào ${label}`, `vào ${label.toLocaleLowerCase('vi')}`)
      .replaceAll(`chọn ${label}`, `chọn ${label.toLocaleLowerCase('vi')}`)
  }
  // Sentence/list boundaries and explicitly quoted UI labels start afresh.
  return text.split(/[.!?…\n·•→:]|[“”"]|(?:^|\s)Q\.(?=\d)/u).flatMap(sentence => {
    const words = sentence.match(/\p{L}+(?:-\p{L}+)*/gu) ?? []
    return words.slice(1).filter(word => /^\p{Lu}/u.test(word))
  })
}

function contentStrings(value: unknown, path = 'content'): [string, string][] {
  if (typeof value === 'string') return [[path, value]]
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, child]) => contentStrings(child, `${path}.${key}`))
}

describe('Vietnamese sentence case', () => {
  it('audits every Vietnamese message for capitalized common words within a label or sentence', () => {
    const violations = [...Object.entries(viMessages), ...contentStrings(viContent)].flatMap(([key, message]) => {
      const words = midSentenceCapitals(message)
      return words.length ? [`${key}: ${words.join(', ')}`] : []
    })
    expect(violations).toEqual([])
  })

  it.each([
    'Mở Cài đặt', 'Chọn khu vực trong Cài đặt mặc định', 'Cài Đặt & Thông Báo',
    'Quản lý Quyền và Thông báo', 'Chọn Vị trí, Khu vực và Tài khoản',
  ])('rejects title case: %s', label => {
    expect(midSentenceCapitals(label).length).toBeGreaterThan(0)
  })

  it.each([
    'Mở cài đặt', 'iOS và Android quản lý quyền của GoGo.',
    'Mở Google Maps. Chọn khu vực.', 'Chọn “Tất cả” hoặc "Vị trí hiện tại".',
    'Mở cài đặt → Quyền và dữ liệu', 'Gửi App Set ID cho Tenjin và Adjust.',
  ])('preserves sentence boundaries, navigation labels and proper nouns: %s', label => {
    expect(midSentenceCapitals(label)).toEqual([])
  })
})
