# PR #542 — Astra r2 fixes

Basis: `075cdc5`, `feature/GOGO-537-account-header-save`.
Scope: the owner's explicit F-01 approach change and supplied F-03 finding.
No commit, push, native rebuild, or deployment.

## F-01 — in-screen avatar adjustment

Removed the Expo Image Picker patch, its workspace/lockfile registrations, and
the Swift delegate harness and fixtures. The installed picker is upstream
17.0.11; its promise can resolve before UIKit finishes dismissal.

After awaiting selection, Account renders `AvatarEditor` as its full-screen
content. The editor uses a `GestureHandlerRootView`, without React Native
`Modal`, presentation callbacks, or timing assumptions. The Account component
and its form stay mounted while its normal controls are absent. Closing or
choosing another image unmounts the editor, including when the same URI is
selected again. The source sheet still finishes closing before launching the
native picker. Upload still starts only after confirmation.

Android back closes an idle editor and preserves the Account draft. Back and
close controls are blocked during upload. Upload failures retain the editor
and its adjustments for retry.

Regression evidence:

- Before implementation, the camera/library and fast-selection regressions fail
  because the confirmation control has a native `Modal` ancestor.
- Delayed camera and library results each repeat three selections; no editor or
  upload appears before promise completion, and the resulting editor has no
  modal ancestor or underlying Account controls.
- Immediate selection repeats the same local URI three times and verifies crop
  state resets on every new selection.
- Existing upload, permission, cancellation, removal and failure cases remain.
- Android back checks cover draft preservation and the uploading guard.

These are component regressions. Device picker animation acceptance was not run.

## F-03 — shared neutral export variant

Stitch source: screen `d5e6daa90cd74dbb85bd938e39f10d27` in project
`17315762413421369447`, fetched through Stitch during this fix. Its export
action uses a muted surface, neutral border and neutral text/icon.

Account now selects `SecondaryBtn variant="neutral"`. The shared Button owns
the styling: `surface.subtle` background, `border.hairline` border,
`text.primary` label/icon/spinner, `surface.card` pressed background, and
`text.secondary` disabled label/icon. Loading preserves the neutral appearance
and blocks duplicate presses. No per-screen button styles were added.

Before implementation, Account's neutral assertion and all eight theme cases
fail against accent-colored borders and foregrounds. The shared regression
evaluates the real styles in all four accents in Light and Dark, including
normal, pressed, loading and disabled states and resolved SVG icon colors.

## Dependency installation and checks

`pnpm install --frozen-lockfile` was attempted and fails with `ENOTFOUND
registry.npmjs.org`. A second attempt after dependency restoration has the same
failure (exit 1). The install removes the old local dependency tree before
fetching, so dependencies were restored as private filesystem clones from
`mobile-535`, whose project and installed lockfiles both match this worktree's
updated lockfile byte-for-byte. Copied binary wrappers were relocated to this
worktree. The sibling was not modified. The installed picker delegate is the
unpatched upstream file, matching the sibling's SHA-256:
`7c6dbec566169d4ee7731ce3134db9156fd368c6bf98f4949a08554a990b5ead`.

`pnpm install --lockfile-only --offline --frozen-lockfile --ignore-scripts`
passes (exit 0). This validates the lockfile; it does not claim a fresh complete
dependency installation.

Code/test/dependency snapshot: `rs-fef281a9c74d` (scope `src`, `patches`,
`pnpm-workspace.yaml`, `pnpm-lock.yaml`; verification docs excluded).
Manifest: `/tmp/pr542-snapshots/pr542-r2-rs-fef281a9c74d/MANIFEST.txt`.

| Check | Result |
| --- | --- |
| `pnpm typecheck` | PASS, exit 0 |
| `pnpm lint` | PASS, exit 0, no lint warnings |
| Focused avatar + neutral UI regressions | PASS, exit 0: 2 suites, 35 tests |
| `pnpm test` | Exit 1: 136 suites pass, 1 fails, 1 skips; 1,649 tests pass, 3 fail, 39 skip |
| `pnpm test:ui --runInBand` | PASS, exit 0: 200 suites, 2,524 tests |
| `git diff --check` | PASS |

The three unit failures are in the unchanged distribution-wrapper tests at
`src/shared/config/__tests__/distribute-wrapper.test.ts:208`, `:234`, `:258`
(live owner, live recorded process group, lock retention after child exit).
`/bin/ps -o lstart= -p $$` is blocked with `operation not permitted`. An isolated
`git archive HEAD` baseline at `075cdc5` reproduces exactly these three failures
(23 pass, 3 fail). No distribution code, tests, exclusions, or sandbox settings
were changed.

Logs: `/tmp/pr542-before.log`, `/tmp/pr542-focused.log`,
`/tmp/pr542-install.log`, `/tmp/pr542-install-restored.log`,
`/tmp/pr542-lockfile.log`, `/tmp/pr542-typecheck.log`, `/tmp/pr542-lint.log`,
`/tmp/pr542-test.log`, `/tmp/pr542-test-ui.log`, `/tmp/pr542-baseline.log`.

Final snapshot verification: `MATCH rs-fef281a9c74d`. HEAD remains `075cdc5`.
F-01 and F-03 are implemented with passing focused regressions; full unit and
fresh-install gates retain the environment failures recorded above.
