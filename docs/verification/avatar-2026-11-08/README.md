# #537 account/avatar update — 2026-11-08

This update builds on the dirty `feature/GOGO-537-account-header-save` worktree. Existing changes were retained; nothing was committed or pushed. This report supersedes the avatar-specific description in `../issue-537-stitch-account-defaults.md`.

## Stitch evidence

Read through Stitch MCP `get_screen`, then `download_file` for both HTML and screenshot, project `17315762413421369447`:

| Screen | ID | Downloaded evidence |
| --- | --- | --- |
| Updated account | `d5e6daa90cd74dbb85bd938e39f10d27` | Same-name `.html` and `.jpg` here |
| Avatar source sheet | `5f211d1041af4663a6951982a810c4de` | Same-name `.html` and `.jpg` here |
| Avatar adjustment editor | `41facfc43b0c451b9d5742a00773a4d5` | Same-name `.html` and `.png` here |

The account HTML includes the source sheet. Its screenshot shows that sheet open. The source-sheet HTML has a shorter background account page; the dedicated account source remains authoritative for the page itself. No Stitch screens were modified.

## Implementation / files:lines

| File | Entry line | Change |
| --- | ---: | --- |
| `src/features/account/account.view.tsx` | 195 | Sheet dismissal → camera/library selection → local crop → existing upload/attach hooks; removal uses existing hook; stale account feedback guarded |
| `src/features/account/account.view.tsx` | 344 | Avatar opens source sheet; ordinary caption and inline removal moved out of the default avatar block |
| `src/features/account/account.style.tsx` | 27 | 32-point visual edit badge inside a 44-point target; avatar ring |
| `src/features/account/avatar-source-sheet.view.tsx` | 9 | Source actions, descriptions, conditional removal, cancel |
| `src/features/account/avatar-source-sheet.style.tsx` | 3 | Theme-aware grouped source rows |
| `src/features/account/avatar-editor.view.tsx` | 13 | Circular crop mask, drag/pinch, zoom slider/buttons, rotate, center, flip, reset, choose another, confirm; accessible equivalents |
| `src/features/account/avatar-editor.style.tsx` | 4 | Fixed dark editor workspace from Stitch, safe areas and responsive crop viewport |
| `src/shared/media/pick-avatar.ts` | 97 | In-context source permissions and recoverable denied/unavailable/cancel results |
| `src/shared/media/pick-avatar.ts` | 116 | Rotate/flip/crop/resize/re-encode to JPEG before existing avatar upload |
| `src/shared/media/avatar-crop.ts` | 5 | Preview/output crop coordinates and image-bound clamping |
| `src/shared/ui/sheet.view.tsx` | 213 | Avatar appearance on the shared animated sheet; same reduced-motion and modal lifecycle behavior |
| `src/shared/ui/sheet.style.tsx` | 27 | Avatar sheet canvas and handle |
| `src/shared/ui/tokens.ts` | 413 | Stitch avatar/account type sizes |
| `src/shared/ui/tokens.ts` | 598 | Fixed photo-workspace colors |
| `src/shared/ui/theme.ts` | 85 | Expose photo-workspace tokens in both modes |
| `src/shared/ui/material-icon.tsx` | 7 | Source/editor icons |
| `src/shared/i18n/vi.ts` | 378 | Vietnamese source/editor/fallback/a11y labels |
| `src/shared/i18n/en.ts` | 387 | English equivalent labels |
| `app.config.ts` | 327 | Camera permission purpose, no microphone permission requested |
| `locales/vi.json`, `locales/en.json` | 4 | Localized iOS camera purpose strings |
| `src/features/__tests__/account-avatar.spec.tsx` | 95 | Selection, upload errors, removal, localized sheet, cancellation and modal sequencing |
| `src/features/__tests__/account-date-of-birth.spec.tsx` | 284 | Retain 44-point touch target assertion and inspect the nested visual badge color |
| `src/shared/media/__tests__/pick-avatar.spec.ts` | 29 | Permission isolation/fallback, cancel/hardware failure, actual transformation action ordering, conversion failure |
| `src/shared/media/__tests__/avatar-crop.test.ts` | 4 | Crop coordinates, rotation/bounds, viewport independence |
| `src/shared/ui/__tests__/type-scale.test.ts` | 53 | Register owner-specified sizes within the existing type gate |

## Behavior and limits

No API feature was invented. Camera/library, upload, attach, and remove use installed Expo modules and existing API hooks. Failed transformation never substitutes the uncropped original. Cancel never uploads. The account avatar stays server-owned; a local image is only an editing preview. Camera denial/unavailability offers Settings or library; library denial offers Settings or camera. Permission text changes require a rebuilt native binary to take effect. Hardware, native permission dialogs and real network upload were not exercised here.

## Deviations / acceptance still open

**Not a 100% Stitch acceptance claim. Paired app-versus-Stitch screenshot comparisons completed: 0/3 screens.** Simulator inspection failed with `CoreSimulatorService connection became invalid`, `Operation not permitted`, and `Connection refused` under this sandbox. Source HTML and screenshots were downloaded and inspected, but no new app screenshot pair could be captured.

| Item | Remaining difference / evidence |
| --- | --- |
| Typography | App retains embedded Inter; Stitch requests Plus Jakarta Sans. Avatar-specific sizes and hierarchy are tokenized, but font-face parity is unresolved. |
| Icons | Shared vector icons replace Stitch's Material Symbols / outline SVGs; the pinch hint uses a vector gesture icon instead of the emoji prohibited by the existing copy gate. Exact glyph parity is unresolved. |
| Backdrop | Shared sheet keeps its existing solid translucent scrim; Stitch shows a blurred backdrop. Exact backdrop parity is unresolved. |
| Light/Dark | Source sheet uses existing semantic surface/text/accent/status tokens in both modes. The photo editor stays dark in both modes, as its supplied source specifies. Separate owner Dark source designs and paired runtime screenshots were not verified. |
| Native accessibility | 44-point touch areas surround smaller visuals; slider and pan have screen-reader actions. VoiceOver/TalkBack device verification remains open. |
| Account page | Existing personal/data/delete sections were retained. Default avatar caption and inline removal were removed in favor of the supplied source sheet. Whole-page geometry remains subject to screenshot comparison. |

## Verification

- `pnpm typecheck`: exit 0.
- `pnpm lint`: exit 0, no warnings.
- `pnpm test`: exit 1 — 136 files / 1,649 tests passed, 39 tests skipped; three failures in unchanged `src/shared/config/__tests__/distribute-wrapper.test.ts` at lines 208, 234, 258. These inspect process ownership/groups using `ps`; direct `ps -o lstart= -p $$` is denied with `operation not permitted` in this sandbox. Neither that test nor `scripts/distribute.sh` was edited.
- `pnpm test:ui --runInBand`: exit 0 — 199 suites, 2,487 tests passed (final run, 87.769 seconds).
- `git diff --check`: exit 0.
