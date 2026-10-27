import { describe, expect, it } from 'vitest'

import { sheetKeyboardOffset } from '../keyboard-offset'

/** iOS acceptance BUG2 (#378): the page sheet's gap from the top of the window. */
describe('sheetKeyboardOffset', () => {
  it('is the gap above an iOS page sheet: window height minus sheet height', () => {
    // iPhone SE (3rd gen): 667pt window, the sheet 40pt down.
    expect(sheetKeyboardOffset({ windowHeight: 667, sheetHeight: 627, os: 'ios' })).toBe(40)
    expect(sheetKeyboardOffset({ windowHeight: 844, sheetHeight: 790.5, os: 'ios' })).toBe(54)
  })

  it('is 0 before the sheet has been measured, and never negative', () => {
    expect(sheetKeyboardOffset({ windowHeight: 667, sheetHeight: null, os: 'ios' })).toBe(0)
    expect(sheetKeyboardOffset({ windowHeight: 667, sheetHeight: 0, os: 'ios' })).toBe(0)
    expect(sheetKeyboardOffset({ windowHeight: 667, sheetHeight: 700, os: 'ios' })).toBe(0)
  })

  it('is 0 on Android, which opens GoGo AI full screen and resizes for the keyboard itself', () => {
    expect(sheetKeyboardOffset({ windowHeight: 800, sheetHeight: 760, os: 'android' })).toBe(0)
  })
})
