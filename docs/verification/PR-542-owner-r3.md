# PR #542 — owner sheet/avatar changes and Astra r3

Basis: `62a4d0e`, branch `feature/GOGO-537-account-header-save`, worktree `mobile-537`.
Owner instructions: 2026-11-08, A–D and F-04/F-03. No commit, push, native rebuild or deployment.
Source/test review snapshot: `rs-1de76234beaa` (scope `src`; verification docs excluded).
Manifest: `/tmp/pr542-r3-snapshots/pr542-r3-final-rs-1de76234beaa/MANIFEST.txt`.

## Changes and acceptance

- **A — shared sheet surfaces:** source rows now use shared `SheetOptionList` and `IconChip`. The options card uses `surface.card`, icon chips use `accent.soft` / `status.dangerSoft`, without outlines. The source-sheet cancel uses the shared borderless neutral button. The saved Stitch HTML has row separators (`avatar-2026-11-08/5f211d1041af4663a6951982a810c4de.html:167`), so rows retain `border.hairline` at the native hairline width. The owner request overrides the old outer/card/chip/button borders in that HTML.
- **Other sheets:** shared ResultSheet cancel actions use neutral; destructive confirmations use a shared danger tint without an outline (logout/delete). Shared area-button outlines are removed; province/commune fields retain their existing `border.hairline` token. Birthday close/summary/picker/selected rows/shortcuts use surfaces; cancel uses neutral. Existing hairline heading/shortcut separators remain.
- **B — success feedback:** attaching the avatar clears the editor and calls `AccessibilityInfo.announceForAccessibility`. No success status text or replacement text is rendered below the avatar. The localized success key is retained only for the announcement, without the check glyph.
- **C — permissions:** `selectAvatar` reads the selected source permission first. Undetermined requests system permission immediately in context; granted opens that source directly; denied/blocked returns without requesting again. A denied camera/library shows shared `MediaPermissionSheet`, with a source icon, localized reason, Settings, alternative source and Cancel. Unavailable hardware/picker uses the same sheet with unavailable copy, alternative source and Cancel. The inline Account permission links/paragraph are removed. Sheet dismissal completes before Settings or another system picker is launched. Every retry reads fresh system permission.
- **D / F-03 — neutral export:** the neutral button now skips all accent kind styles, including onAccent, pressed and disabled paths. Label/icon/spinner use neutral foreground tokens; there is no outline. Component regressions cover all four accents in Light/Dark, normal/pressed/loading/disabled and onAccent. **The running simulator bundle and fresh Light/Dark screenshots remain unverified; F-03 is open for native visual acceptance.** This code hardening does not prove the cause of the owner's stale/accent simulator rendering.
- **F-04 — editor navigation:** the editor disables the native stack's `gestureEnabled` in a layout effect and restores it on unmount. Editing and uploading therefore keep iOS swipe-back disabled. Explicit close/Android back preserve the Account draft, and Android back remains consumed while uploading. Regressions verify the navigation options, draft retention and restoration after close/success.

## Regression and check evidence

The four current regression suites (Account avatar, picker helper, neutral button, sheet surfaces) were copied into an archived `62a4d0e` production source tree. They fail before the change: **4 suites failed; 81 failed / 20 passed / 101 tests** (`/tmp/pr542-r3-baseline-ui.log`). Failures cover visible success feedback, missing permission sheets, repeated system requests, missing gesture disabling and outlined surfaces/buttons. The same four regression suites pass after the change, included in the final full UI run.

| Check | Final result |
| --- | --- |
| `pnpm typecheck` | PASS, exit 0 |
| `pnpm lint` | PASS, exit 0, no lint warnings |
| `pnpm test` | Exit 1: 136 suites pass, 1 fails, 1 skips; 1,649 tests pass, 3 fail, 39 skip (baseline sandbox process-lock failures below) |
| `pnpm test:ui --runInBand` | PASS, exit 0: 201 suites, 2,586 tests |
| `git diff --check` | PASS, exit 0 |
| Source snapshot verification | MATCH `rs-1de76234beaa`, exit 0 |

Final logs: `/tmp/pr542-r3-typecheck-final.log`, `/tmp/pr542-r3-lint-final.log`, `/tmp/pr542-r3-test-final.log`, `/tmp/pr542-r3-test-ui-final.log`.

The distribution wrapper's three failures at `src/shared/config/__tests__/distribute-wrapper.test.ts:208`, `:234`, `:258` are reproduced with its unchanged code/test at archived `62a4d0e`: **23 passed / 3 failed**, exit 1 (`/tmp/pr542-r3-baseline-unit.log`). Direct `/bin/ps -o lstart= -p $$` returns `operation not permitted`. No distribution implementation, exclusions or assertions were changed.

## Native verification blocker

`rtk xcrun simctl list devices booted` cannot connect to CoreSimulatorService and cannot open its log under this sandbox. Computer Use inventory lists Simulator, but binding it returns `Computer Use was not approved to use Simulator`. No approval escalation is available in this session. No running bundle identity, camera permission dialog, physical camera behavior, actual iOS swipe gesture, or new native screenshot was verified. No previous screenshot is relabeled as showing these uncommitted changes. Native Light/Dark export evidence requested by F-03 remains outstanding.

## Files:lines

| File | Line | Change |
| --- | ---: | --- |
| `src/shared/ui/sheet-option-list.view.tsx` | 18 | Shared grouped sheet options |
| `src/shared/ui/sheet-option-list.style.tsx` | 4 | Raised surface, hairline divider, row states |
| `src/shared/ui/icon-chip.view.tsx` | 6 | Shared decorative source/permission icon |
| `src/shared/ui/icon-chip.style.tsx` | 4 | Soft tints without outlines |
| `src/shared/ui/button.view.tsx` | 113 | Neutral branch excludes accent kind styles |
| `src/shared/ui/button.style.tsx` | 20 | Borderless area buttons |
| `src/shared/ui/button.style.tsx` | 61 | Neutral surface and destructive tint |
| `src/shared/ui/result-sheet.view.tsx` | 43 | Shared neutral secondary actions |
| `src/features/account/avatar-source-sheet.view.tsx` | 25 | Shared options/chips and neutral cancel |
| `src/features/account/avatar-source-sheet.style.tsx` | 3 | Retain only source-sheet layout |
| `src/shared/media/pick-avatar.ts` | 97 | Permission status → request/open/denied/unavailable |
| `src/shared/media/media-permission-sheet.view.tsx` | 14 | Shared camera/library denied/unavailable recovery |
| `src/shared/media/media-permission-sheet.style.tsx` | 3 | Shared recovery layout |
| `src/features/account/account.view.tsx` | 199 | Defer Settings/fallback until the sheet closes |
| `src/features/account/account.view.tsx` | 249 | Accessibility-only avatar success feedback |
| `src/features/account/account.view.tsx` | 448 | Shared permission sheet replaces inline permission block |
| `src/features/account/account.style.tsx` | 59 | Remove unused inline permission-action style |
| `src/features/account/avatar-editor.view.tsx` | 19 | Disable/restore native stack gesture |
| `src/features/account/birthday-sheet.view.tsx` | 115 | Neutral cancel |
| `src/features/account/birthday-sheet.style.tsx` | 9 | Borderless birthday surfaces/controls |
| `src/shared/i18n/vi.ts` | 385 | Vietnamese permission/recovery copy |
| `src/shared/i18n/vi.ts` | 457 | Announcement without check glyph |
| `src/shared/i18n/en.ts` | 394 | English permission/recovery copy |
| `src/shared/i18n/en.ts` | 464 | Announcement without check glyph |
| `src/features/__tests__/account-avatar.spec.tsx` | 122 | Announcement only, native gesture options, permission/fallback/Settings branches |
| `src/features/__tests__/account-date-of-birth.spec.tsx` | 424 | Birthday surface expectations |
| `src/shared/media/__tests__/pick-avatar.spec.ts` | 36 | Camera/library undetermined/granted/denied/blocked |
| `src/shared/ui/__tests__/button-neutral.spec.tsx` | 24 | All accents/modes and neutral style precedence |
| `src/shared/ui/__tests__/sheet-surfaces.spec.tsx` | 26 | All accents/modes, source/logout/delete/area/birthday surfaces |
| `src/shared/ui/__tests__/button.spec.tsx` | 108 | Shared danger tint expectation |
| `src/shared/ui/__tests__/result-sheet.spec.tsx` | 64 | Destructive confirmation retains loading state without outline |
