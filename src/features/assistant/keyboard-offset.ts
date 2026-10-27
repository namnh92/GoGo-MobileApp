/**
 * How far GoGo AI's page sheet sits below the top of the window, which is
 * what its `KeyboardAvoidingView` must be told (iOS acceptance BUG2, #378).
 *
 * `KeyboardAvoidingView` compares its own frame — measured relative to its
 * parent — with the keyboard's top in *window* coordinates. Full screen the
 * two agree. In an iOS page sheet the parent starts some 40pt down the window
 * (status bar plus the sheet's top gap), so the view believed the keyboard
 * overlapped it by that much less: the composer ended under the keyboard and
 * the disclaimer / "Dừng sẽ giữ phần đã viết." line with it.
 *
 * A page sheet always reaches the bottom edge of the window, so the gap is the
 * window's height minus the sheet's. Android opens GoGo AI full screen and
 * resizes the window for the keyboard itself: no offset.
 */
export function sheetKeyboardOffset({
  windowHeight,
  sheetHeight,
  os,
}: {
  windowHeight: number
  sheetHeight: number | null
  os: string
}): number {
  if (os !== 'ios' || sheetHeight === null || !(sheetHeight > 0) || !Number.isFinite(windowHeight)) return 0
  return Math.max(0, Math.round(windowHeight - sheetHeight))
}
