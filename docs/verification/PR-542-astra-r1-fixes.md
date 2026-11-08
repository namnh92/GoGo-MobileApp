# PR #542 — Astra r1 fixes

Historical r1 evidence. The native F-01 approach and incomplete F-03 disposition
below are superseded by [Astra r2 fixes](PR-542-astra-r2-fixes.md).

Basis: `96aec32`, existing `feature/GOGO-537-account-header-save` worktree.
Changes are uncommitted; no commit, push, PR comment, or simulator deployment.
Scope follows the owner's explicit request to fix the supplied findings.

## F-01 — native picker dismissal

Expo Image Picker 17.0.11 calls its result handler before UIKit finishes
dismissing either `PHPickerViewController` or `UIImagePickerController`. A fast
local image can therefore resolve `selectAvatar()` while UIKit is still
dismissing the picker, before `AvatarEditor` can safely present its modal.

`patches/expo-image-picker@17.0.11.patch` moves selection and explicit
cancellation delivery into UIKit's `dismiss(animated:completion:)` completion.
Interactive dismissal continues to use `presentationControllerDidDismiss`.
The existing Account flow now awaits that native completion through its existing
`selectAvatar()` call. No timeout or JavaScript animation heuristic is involved.
The exact-version patch is registered in `pnpm-workspace.yaml` and the lockfile.

Regression evidence:

- The new Vitest suite compiles the installed Expo Swift delegate with controlled
  UIKit/PhotosUI test doubles. Only the framework import is replaced; the
  delegate's implementation is compiled directly from `node_modules`.
- Before the patch: five failures for fast library selection, three consecutive
  local selections, camera selection, library cancellation, and camera
  cancellation. Each failure reports result delivery before dismissal completes.
  Interactive cancellation already passes.
- After the patch: all six scenarios pass. The completion is controlled
  independently of immediate result processing, so image-processing latency
  cannot hide the race. This native-only suite runs on macOS; other hosts skip it.
- The Account component regression holds picker completion pending, verifies no
  editor/upload opens, then completes selection and repeats with the same local
  image. It waits for the shared source sheet's dismissal before asserting picker
  launch.
- The patched delegate and upstream status-bar helper also typecheck against the
  real iPhone Simulator 26.4 SDK, targeting iOS 15.1, with Swift 5 language mode.
  The upstream helper emits its existing `isStatusBarHidden` deprecation warning.

The native patch requires a rebuilt iOS binary. No live UIKit animation, device
picker, or simulator presentation test was performed; the Swift harness proves
delegate ordering, not device acceptance. Recheck the patch when upgrading Expo
Image Picker.

## F-02 — short deletion confirmation

The Account page retains `account.deleteBody` and `account.deleteKept`.
Only the confirmation sheet uses the new `account.deleteConfirmBody`:

- vi: “Không thể hoàn tác. Đánh giá và ảnh đã đóng góp vẫn được giữ ẩn danh.”
- en: “This cannot be undone. Contributed reviews and photos are kept anonymously.”

The vi/en component assertions fail before the fix because the short body is
absent, and pass after. They also assert that both detailed paragraphs stay on
the page, are absent from the sheet, and that Cancel/Confirm behavior and button
order remain intact.

## F-03 — missing finding text

The supplied message ends at `[F-03 P2] account.view.tsx:405`; it contains no
failure scenario or requested fix. PR #542's connected GitHub discussion returned
no comments. Clarification was requested while the independent fixes proceeded.
F-03 remains open; no behavior was invented from the line reference alone.

## Dependency verification

The sandbox cannot resolve `registry.npmjs.org`, and its offline cache is
incomplete. An offline install accepted the frozen lockfile but could not restore
all dependencies. Installed dependencies were restored as private filesystem
clones from `mobile-535`, whose installed lockfile matches this worktree's
original lockfile byte-for-byte. Copied binary wrappers were relocated to this
worktree. The sibling's native source remains unchanged.

The patch was applied to this worktree's installed delegate. Separately, an
isolated offline pnpm fixture containing the pristine delegate and the real patch
successfully applies the patch through pnpm itself; its output matches this
worktree's installed delegate byte-for-byte, and pnpm generates the same patch
SHA-256 recorded in this lockfile. The fixture uses a minimal native-only package
manifest to avoid unrelated network dependencies.

`pnpm install --lockfile-only --offline --frozen-lockfile --ignore-scripts`
also exits 0. This does not claim a complete fresh dependency installation.

## Final checks

| Check | Final result |
| --- | --- |
| `pnpm typecheck` | PASS, exit 0 |
| `pnpm lint` | PASS, exit 0, no warnings |
| `pnpm test` | Exit 1: 137 suites pass, 1 fails, 1 skips; 1,655 tests pass, 3 fail, 39 skip |
| `pnpm test:ui --runInBand` | PASS, exit 0: 199 suites, 2,503 tests |
| Native delegate regressions (included in `pnpm test`) | PASS: all 6 scenarios |
| Real iOS SDK delegate typecheck | PASS, exit 0; upstream deprecation warning noted above |
| Frozen lockfile validation | PASS, exit 0 |
| `git diff --check` | PASS |

The three unit failures are in the unchanged
`src/shared/config/__tests__/distribute-wrapper.test.ts`, lines 208, 234, 258:
live-owner detection, recorded live build-group recovery, and live-group lock
retention after child exit. They fail before and after these fixes. Process
inspection is blocked here: `/bin/ps -o lstart= -p $$` reports `operation not
permitted`. No distribution code, assertions, exclusions, or sandbox settings
were changed to manufacture a green result.

Final status: F-01 and F-02 fixed with regression evidence; F-03 remains
incomplete pending its missing description. HEAD remains `96aec32`.
