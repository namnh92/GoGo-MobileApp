# #537 Account birthday picker — 2026-11-08

Source: Stitch project `17315762413421369447`, screen
`f553e0a554d44068838136c4330e27f9`, “Tài khoản · Chọn ngày sinh - GoGo”.
Read the screen metadata, HTML, and 780 × 2076 screenshot through Stitch MCP.
The owner explicitly authorized this scoped implementation in the existing dirty
`feature/GOGO-537-account-header-save` worktree. Existing work was preserved;
no commit or push was performed.

## Behavior

- Tapping/focusing the birthday field or activating it with a screen reader opens
  the existing shared animated `Sheet`; the soft keyboard stays hidden.
- Day/month/year wheels, selected-date summary, ±10-year shortcuts, Today,
  close, Cancel, and Confirm follow the source composition. Vietnamese and
  English copy are in the existing catalogs; semantic tokens cover both themes.
- The picker owns a temporary selection. Confirm updates React Hook Form and
  its existing validation/dirty state. Only the header Save persists to the BFF.
- Cancel, close, backdrop, Android back, and accessibility escape discard the
  picker selection. Reopening starts from the current form value.
- Month/year changes clamp the day to a real date (including Gregorian leap
  years). Scroll updates keep the summary/current draft in sync before momentum
  ends. Screen readers adjust each wheel with increment/decrement actions.
- Validation remains `checkTypedDateOfBirth`: existing calendar dates and no
  date after today in Asia/Ho_Chi_Minh. The function has no age cutoff; none was
  invented. All supported years from 0001 remain reachable; decade shortcuts
  clamp at year 1 and Vietnam today.
- Refetch does not overwrite an open picker selection; cancelling preserves
  the latest form value. Account changes unmount the previous account's picker.

## Verification

- `pnpm typecheck`: exit 0.
- `pnpm lint`: exit 0, no warnings.
- Focused Account suite: 40 tests pass, including original form/server behavior
  plus picker confirmation, all dismissal paths, leap/short-month clamping,
  future dates, shortcuts, a11y actions, vi/en, Light/Dark token resolution,
  background refetch, and account switching.
- `pnpm test`: exit 1; 136 suites pass, 1 fails, 1 skips. 1649 tests pass,
  3 fail, 39 skip. The three failures are in the unchanged
  `src/shared/config/__tests__/distribute-wrapper.test.ts` (lines 208, 234, 258).
  They require process inspection; this sandbox denies `ps` with
  `operation not permitted`. No distribution script or test was changed.
- `pnpm test:ui --runInBand`: exit 0; 199 suites and 2501 tests pass.
  Final focused Account/i18n verification after the wheel scroll adjustment:
  2 suites and 81 tests pass (40 Account tests plus 41 catalog checks).
- `git diff --check`: passes.

## Deviations and verification limits

- Stitch retains a text input showing dd/mm/yyyy. Its display/control remains;
  tapping uses the picker instead of opening the soft keyboard. The original
  typed-date validation and clear action remain intact.
- Reuse the app's shared sheet animation, dim backdrop, font family and semantic
  typography/button tokens. The reference uses Plus Jakarta Sans and a blurred
  backdrop; this implementation uses the established Inter tokens and the
  shared unblurred backdrop. No separate sheet implementation was introduced.
- Close and shortcut touch targets are enlarged to at least 44 pt for a11y.
  Light/Dark styling uses existing tokens; Stitch supplied a Light reference.
- No device/simulator screenshot or interactive native gesture pass was captured
  in this run; automated tests do not establish pixel-perfect visual parity.
- The referenced `@RTK.md` was absent from the worktree and searched workspace
  locations. The parent GoGo AGENTS.md and relevant workspace rules were read.
