# PR #543 — Astra r1 fixes

Base: `7a81fb4`, branch `feature/GOGO-541-button-height`. Local changes only.

## F-01 — parent-constrained touch targets

Saved province headers now have a centered `touchTarget.min` (44pt) minimum
height. The 40pt button retains its visual size; its expanded touch rectangle
can reach 44pt inside the parent even with a one-line heading.

Sweep of every small shared Button/IconBtn consumer:

| Consumer | Immediate parent at its shortest | Result |
| --- | --- | --- |
| Saved province action | `groupHeader`: formerly 40pt | Fixed to ≥44pt, centered |
| Saved quick-save | `linkRow`: ≥44pt | Already centered |
| Onboarding back and skip (both skip variants) | `header`: ≥44pt | Already centered |
| Onboarding guest | Last action below the 48pt primary and 8pt gap | 48pt reachable after bottom-edge clipping |
| Profile edit | `identity`: 64pt avatar | Already centered |
| Room invite-code copy | `codeRow`: 40pt control + 24pt padding | Already centered |
| Search filter reset | `sheetFooter`: 48pt primary sibling | Already centered |

Search's filter toggle explicitly uses regular (48pt) size. No other small
Button/IconBtn consumer was found (`size="small"`, default IconBtn size, and
the implicit small Stitch guest/skip variants were included).

`button-parent-geometry.spec.tsx` renders the real button and parent styles and
intersects hitSlop with the shortest parent rectangle. Its generic boundary
case proves that even 100pt hitSlop cannot make a 40pt parent reachable at
44pt. A Saved-screen test checks the actual province action's parent.
This is a style/geometry regression check, not a native layout measurement.

## F-02 — shared pressed fills

Removed pressed background styles and bindings from `AppHeaderAction`,
`HeaderNotificationButton`, `SheetOptionList`, `SegmentedControl`, `Chip`, and
embedded `AdministrativePicker` fields. Selected and disabled styles remain.
The remaining shared button pressed styles only remove a shadow or apply the
existing scale feedback; none changes fill, tint, or border color.

Tests hold real Pressability responders in Light and Dark, including header
back/Save/bell, enabled/disabled sheet actions, chip variants, selected and
unselected segments, and administrative fields. The Account-screen regression
edits the name to enable its actual Save action and holds both Save and Back.

## Regression evidence

- Before: the parent geometry test reported 40pt instead of ≥44pt; shared
  pressable tests detected pressed fill changes.
- After: both new suites pass (37 tests), plus actual Saved and Account cases
  in their existing suites.
- `pnpm typecheck`: exit 0.
- `pnpm lint`: exit 0.
- `pnpm test`: exit 1; 136 files pass, one fails, one skips; 1649 tests pass,
  three fail, 39 skip. The three failures are unchanged distribution-wrapper
  process-liveness tests (`distribute-wrapper.test.ts`:208, 234, 258).
  This sandbox denies `ps` and `pgrep`; direct probes reproduce those denials.
  Both `scripts/distribute.sh` and its test are unchanged from HEAD.
- `pnpm test:ui --runInBand`: exit 0; 204 suites and 2704 tests pass.
- `git diff --check`: exit 0.

Logs: `/tmp/mobile-543-typecheck.log`, `/tmp/mobile-543-lint.log`,
`/tmp/mobile-543-test.log`, `/tmp/mobile-543-ui.log`,
`/tmp/mobile-543-regression-before.log`, `/tmp/mobile-543-feedback-before.log`,
`/tmp/mobile-543-regression-after.log`.

No commit or push. No simulator acceptance claimed.
