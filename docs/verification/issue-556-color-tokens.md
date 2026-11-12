> Cập nhật round 6h (2026-11-12): màn Quản lý phòng đã bỏ; các ghi nhận
> manage bên dưới là bằng chứng lịch sử. Chức năng hiện tại nằm ở sảnh phòng;
> `/room/[roomId]/manage` chỉ redirect về sảnh. Xem
> [quyết định hiện hành](../redesign/issue-595-unified-room-edit.md#round-6h--quyết-định-owner-2026-11-12-10-thay-màn-quản-lý-phòng).

# #556 redo — Stitch AppToken colour inventory

Prepared before source edits on 2026-11-08, branch `feature/GOGO-556-app-color-tokens`, base `f28f617`. UI-only; no commit or push. The rejected `c104788` is not a value source.

## 2026-11-10 second rebase step — #587 / #590

Resolved the nine conflicted files in the working tree without running git. This section supersedes the first-step target/preservation claims below for the new replay; the earlier gate results are historical.

- Kept #590 pull-to-refresh in Notifications, Explore, and Saved, the pinned Notifications toolbar/chips (one toolbar, outside the scrolling feed), and the newer list/group spacing.
- Kept #587 compact header logo, divider, 56-point row, 16-point tab-header bottom spacing, shared tab spacing, Splash option B, Light/Dark launch artwork, and adaptive-icon background image.
- `brandLogo` is the shared, immutable brand role group in `tokens.ts`: Deep Navy `#20124A`, white highlights, both star colours, three dot colours, nine spectrum stops, and five bridge stops including their opacity values. GoGoLogo and LoadingIndicator consume this same palette. LoadingIndicator keeps its existing shadow and geometry. No screen palette or raw production colour literal is introduced.
- Native adaptive-icon background reads `brandLogo.background`, preserving #587's `#20124A` (the earlier document's `#CA381F` native icon value is historical). Dark launch keeps its separate image and reads `darkSurface.canvas` (`#181715`); Light launch remains `surface.canvas` (`#FFF8F3`).
- Header divider reads `border.outline`, exactly `#8E706A` Light / `#999999` Dark, in place of the removed `border.strong` name. The logo wordmark reads `text.neutralPrimary`, preserving #587's `#211F1C` Light / `#E6E6E6` Dark instead of repainting it with #559's new primary text role. Brand spectrum, stars, dots, launch colours, layout and motion have no additional rendered-value drift in this step. Other #559 shared-role changes remain documented in the first-step tables below.
- Owner AA values remain Light `status.danger = #CC4B46` and Onboarding caption `text.supporting = #8A6C66`. Existing sheet-header card surface is retained alongside the newer tab-header spacing.

Adjusted regression assertions for the renamed divider role, pinned the complete #587 palette and native assets independently, and updated only the Splash source-binding pin to reflect option B replacing the older accent-coloured mark. Existing colour-value pins and contrast thresholds are unchanged.

Preservation evidence: `/tmp/mobile-556-second-preservation.cjs` compares all 14 surviving shared artwork/layout/motion/geometry exports against the pre-resolution current side and checks both owner AA values. PASS. Source backups are in `/tmp/mobile-556-second-rebase-before`. No native build or simulator acceptance is claimed.

Requested gates on the final resolved source:

| Command | Exact result | Log |
| --- | --- | --- |
| `pnpm typecheck` | PASS, exit 0 | `/tmp/mobile-556-second-typecheck.log` |
| `pnpm lint` | PASS, exit 0, no warnings/errors | `/tmp/mobile-556-second-lint-final.log` |
| `pnpm test` | FAIL, exit 1: 145 files passed / 1 failed / 1 skipped (147 total); 1,754 tests passed / 3 failed / 39 skipped (1,796 total) | `/tmp/mobile-556-second-test-final.log` |
| `pnpm test:ui --runInBand` | PASS, exit 0: 233 suites / 3,413 tests / 11 snapshots passed | `/tmp/mobile-556-second-test-ui-final.log` |

The three unit failures are exclusively `src/shared/config/__tests__/distribute-wrapper.test.ts`: “refuses while the owner is alive” (line 208), “refuses recovery while a recorded build process group is still alive” (line 234), and “keeps the lock and run files when a recorded build group is still alive after the child exits” (line 258). A direct `spawnSync('ps', ['-o', 'lstart=', '-p', ...])` check returned `status: null, error: EPERM`; this sandbox denies the process inspection those tests require. The first failure calls `.trim()` on undefined stdout; the remaining two cannot detect live process groups. No process-lock code, assertions, or skips were changed. Colour roles, independent value pins, literal scans, AA contrast and native asset checks all passed.

Initial runs caught stale divider-role references in #587 tests and a pre-option-B Splash source-binding pin. The final runs above include those corrections.

## 2026-11-10 rebase conflict resolution

Rebase target: `c48d50199a7fda675b6efa5b8f8ab646b57aca63`. Resolved **55 blocks in 26 files** in the working tree. No git command, index mutation, rebase continuation, commit or push was run. The rebase owner still needs to stage the resolutions and continue the replay.

The current re-design side owns all layout, typography, behaviour, test coverage and non-colour tokens. In particular, the resolution retains common large/small PlaceCards and current photo credits/badges; map marker selection, dismiss gestures and preview cards; tab icons and label geometry; notification group 10; locked contribution choices, multiline sizing and action rows; raised-chip disabled/selected states; shared loading indicators and submit lifetimes; button heights; and sheet/header behaviour. The older replay's removed controls and geometry are not restored.

Compared the 73 inventoried production view/style files against the exact target using read-only GitHub file snapshots. After explicit palette-to-role substitutions, the source comparison differs only in the equivalent `shadows.stitch` → `shadows.subtle` name and owner AA captions; selected mood/discovery chips also retain #559's `accent.onSoft` AA binding. Default-orange selected foreground values are unchanged. Non-orange accent colours follow the chosen accent as required by #559. Updated binding pins describe the current re-design structure; independent pre-migration colour-value pins remain intact. No live simulator acceptance is claimed for this resolution.

New shared materials already added by re-design are preserved: immutable `brandLogo` artwork (and the shared loading indicator's references to it), plus mode-resolved `overlay.submit`. These are shared artwork/material roles, not screen palettes. Submit stays exactly `rgba(246,243,238,0.85)` in Light / `rgba(24,23,21,0.85)` in Dark; it is deliberately not repainted to the new Stitch canvas. The overlay test now pins that approved material independently. Role vocabulary includes these shared additions while continuing to reject feature/screen colour names. No new raw production colour literal was introduced.

Preserved re-design’s 16-point AppHeader row inset for sheets as well as screens. The older #559 sheet colour follow-up had also removed that inset; the current exact-UI constraint supersedes that geometry change. Its `surface.card` colour binding remains, with Light/Dark before → after disclosed below.

Updated stale post-rebase expectations only where the new role values or retained re-design binding require them: wizard step-number wash stays `accent.soft`; active tab glyphs resolve to `accent.text`; the Light segmented-tab snapshot changes only its `surface.subtle` colour (`#ECE8E1` → `#F3EDE8`), with every geometry/typography field intact. Removed the duplicate `themes` import left by the automatic merge. All AA thresholds remain unchanged, with no expected-failure AA cases.

### Rendered-value changes retained by the required shared-role migration

There is **no additional default-orange value drift from mapping the surviving screen palette**: each direct mapping matches the target value in Light/Dark, apart from the explicit owner AA caption change. Existing consumers of legacy shared roles do repaint when those roles acquire #559's required Stitch values; claiming whole-screen pixel equality would be incorrect. The earlier “Shared roles that change” table lists the app-wide/default propagation. The following target-relative audit lists the changed explicit bindings in the 73 reviewed files, including token, source/screen and before → after. Implicit Text/Icon defaults propagate through the same shared-role table; the native launch changes remain documented separately. Changes for non-orange themes are the accent-following behaviour already required by #559.

| Token | Mode | Screen / shared component | Before → after |
| --- | --- | --- | --- |
| `accent.text` | Light | `app/(tabs)/_layout.tsx`, `features/place-import/contribution-wizard.style.tsx` | `#CA381F` → `#A71E07` |
| `text.secondary` | Light | `app/(tabs)/_layout.tsx`, `features/account/account.style.tsx`, `features/account/account.view.tsx`, `features/account/profile-defaults.view.tsx`, `features/account/theme-accent.view.tsx`, `features/home/home.view.tsx`, `features/notifications/notification-switch.view.tsx`, `features/place-import/contribution-choices.view.tsx`, `features/place-import/contribution-wizard.view.tsx`, `features/place-import/import-photos.view.tsx`, `features/place-import/import.view.tsx`, `features/settings/location-permission.view.tsx`, `features/tabs/profile-upcoming.view.tsx`, `features/tabs/profile.view.tsx`, `features/tabs/saved-city.view.tsx`, `features/tabs/saved.view.tsx`, `shared/administrative/administrative-picker.view.tsx`, `shared/ui/badge.style.tsx`, `shared/ui/button.view.tsx`, `shared/ui/chip.view.tsx`, `shared/ui/search-field.view.tsx` | `#746E68` → `#5A413B` |
| `status.danger` | Light | `features/account/account.style.tsx`, `features/place-import/import.style.tsx`, `shared/ui/labelled-input.style.tsx` | `#C84455` → `#CC4B46` |
| `surface.subtle` | Light | `features/account/account.style.tsx`, `features/account/date-of-birth.style.tsx`, `features/account/theme-accent.style.tsx`, `features/home/home.style.tsx`, `features/notifications/notification-switch.view.tsx`, `features/place-import/contribution-wizard.style.tsx`, `features/place-import/import.style.tsx`, `features/tabs/profile.style.tsx`, `features/tabs/saved.style.tsx`, `shared/ui/badge.style.tsx`, `shared/ui/button.style.tsx`, `shared/ui/chip.style.tsx`, `shared/ui/primitives.tsx` | `#ECE8E1` → `#F3EDE8` |
| `text.primary` | Light | `features/account/account.style.tsx`, `features/account/date-of-birth.style.tsx`, `features/notifications/notification-switch.view.tsx`, `features/place-import/contribution-choices.view.tsx`, `features/place-import/contribution-wizard.style.tsx`, `features/place-import/import.style.tsx`, `features/settings/location-permission.view.tsx`, `shared/administrative/administrative-picker.view.tsx`, `shared/ui/badge.view.tsx`, `shared/ui/button.view.tsx`, `shared/ui/chip.view.tsx`, `shared/ui/search-field.style.tsx` | `#211F1C` → `#1D1B18` |
| `surface.canvas` | Light | `features/account/account.style.tsx`, `features/tabs/profile.style.tsx`, `shared/ui/primitives.tsx`, `shared/ui/sheet.style.tsx` | `#F6F3EE` → `#FFF8F3` |
| `accent.onSoft` | Light | `features/account/profile-defaults.style.tsx`, `features/account/profile-defaults.view.tsx`, `features/account/theme-accent.view.tsx`, `features/notifications/notification-switch.view.tsx`, `features/settings/location-permission.view.tsx`, `shared/ui/badge.view.tsx`, `shared/ui/chip.view.tsx` | `#A72E19` → `#A71E07` |
| `accent.primary` | Light | `features/account/profile-defaults.view.tsx`, `features/account/theme-accent.view.tsx`, `features/onboarding/onboarding-visual.view.tsx`, `features/onboarding/splash.view.tsx`, `features/place-import/contribution-choices.view.tsx`, `features/place-import/contribution-wizard.view.tsx`, `shared/ui/button.view.tsx`, `shared/ui/info-banner.view.tsx` | `#CA381F` → `#A71E07` |
| `border.hairline` | Light | `features/home/home.style.tsx`, `features/place-import/contribution-wizard.style.tsx`, `features/tabs/profile.style.tsx`, `shared/administrative/administrative-picker.style.tsx`, `shared/ui/button.style.tsx`, `shared/ui/chip.style.tsx`, `shared/ui/primitives.tsx`, `shared/ui/search-field.style.tsx`, `shared/ui/sheet.style.tsx` | `#ECE8E1` → `#E3BEB7` |
| `status.successText` | Light | `features/notifications/notification-switch.view.tsx`, `features/place-import/import.style.tsx`, `features/tabs/saved.view.tsx`, `shared/ui/badge.style.tsx`, `shared/ui/badge.view.tsx`, `shared/ui/chip.view.tsx` | `#35765B` → `#00623C` |
| `text.supporting` | Light | `features/onboarding/onboarding-visual.view.tsx` | `#8E706A` → `#8A6C66` |
| `surface.card` (sheet-header background, formerly `surface.canvas`) | Light | `shared/ui/app-header.style.tsx`; current-area and administrative sheets | `#F6F3EE` → `#FFFFFF` |
| `surface.card` (sheet-header background, formerly `surface.canvas`) | Dark | `shared/ui/app-header.style.tsx`; current-area and administrative sheets | `#181715` → `#222222` |
| `status.success` | Light | `features/place-import/contribution-wizard.style.tsx` | `#4FAF86` → `#237C51` |
| `status.warningSoft` | Light | `features/place-import/import.style.tsx`, `shared/ui/badge.style.tsx`, `shared/ui/chip.style.tsx` | `#FCEBCB` → `#FBEBD3` |
| `status.successSoft` | Light | `features/place-import/import.style.tsx`, `shared/ui/badge.style.tsx`, `shared/ui/chip.style.tsx` | `#D9F3E7` → `#ECFFF3` |
| `status.dangerSoft` | Light | `features/place-import/import.style.tsx`, `shared/ui/badge.style.tsx`, `shared/ui/button.style.tsx` | `#FADDE2` → `#FBE3E2` |
| `status.infoSoft` | Light | `shared/ui/badge.style.tsx`, `shared/ui/chip.style.tsx` | `#E5E0FF` → `#E4DFFF` |
| `status.infoText` | Light | `shared/ui/badge.style.tsx`, `shared/ui/badge.view.tsx`, `shared/ui/chip.view.tsx` | `#5F4FD1` → `#5747C8` |
| `status.infoText` | Dark | `shared/ui/badge.style.tsx`, `shared/ui/badge.view.tsx`, `shared/ui/chip.view.tsx` | `#A99DF5` → `#C7BFFF` |

### Requested gates on the resolved tree

Dependencies: the worktree originally had no node_modules. Offline installation was unavailable because a cached tarball was missing. Existing dependencies from sibling `mobile-588` have identical dependency/version maps and identical `pnpm-lock.yaml`; local links reuse those installed packages, with test/lint caches inside this worktree. No package manifest or lockfile changed.

| Command | Exact result | Log |
| --- | --- | --- |
| `pnpm typecheck` | PASS, exit 0 | `/tmp/mobile-556-typecheck-final.log` |
| `pnpm lint` | PASS, exit 0, no warnings/errors | `/tmp/mobile-556-lint-final.log` |
| `pnpm test` | Exit 1: 144 files passed / 1 failed / 1 skipped; 1,742 tests passed / 3 failed / 39 skipped (1,784 total) | `/tmp/mobile-556-test-final.log` |
| `pnpm test:ui --runInBand` | PASS, exit 0: 232 suites / 3,388 tests / 11 snapshots passed | `/tmp/mobile-556-test-ui-final.log` |

Unit failures are exactly `src/shared/config/__tests__/distribute-wrapper.test.ts`: “refuses while the owner is alive” (line 208; sandbox denies `ps`, leaving stdout undefined), “refuses recovery while a recorded build process group is still alive” (line 234), and “keeps the lock and run files when a recorded build group is still alive after the child exits” (line 258). They depend on process inspection unavailable in this sandbox; no lock tests were changed or skipped. All colour-role, literal, contrast, value-pin and submit-overlay unit checks pass.

Additional preservation evidence: `/tmp/mobile-556-preservation.json` reports 73 source files checked against the exact target, with zero unexplained source changes after the listed mappings. `/tmp/mobile-556-preservation.cjs` verifies all 13 non-colour/shared-artwork exports and the renamed subtle shadow equal the target. Production scans report zero conflict markers, removed-palette reads, or colour literals outside tokens.


## Authority and preservation boundary

Owner direction and `/Users/maxnguyen/MyWorks/GoGo/.claude/rules/design-system.md`: Stitch wins over pre-redesign roles. Source values are the base `redesignLight`/`redesignDark`, `darkAccents`, S70-derived dark roles, and Stitch palette HTML. Live MCP read: approved project `17315762413421369447`, Dark palette screen `17818426877502953936` (original `a58c41190f214a94adb2982434e34120`). Light palette `9382f90b8e4b49d9a345d541cd607273` remains readable in source project `8730375380958217191`; it is absent from the destination list. This task does not claim destination migration completion. The explicit #556 redo authorizes this scoped implementation.

- One role set, same keys in both modes. Canvas, card, low, container, high, highest and dim remain separate levels, even where Dark shares values. Inset canvas, muted fill and disabled fill are shared material roles for the distinct neutral Stitch surfaces; they are not collapsed into the warm canvas.
- Neutral primary/secondary foregrounds are also drawn in the Stitch Light palette and Onboarding 2. Supporting text is the approved AA checklist foreground, distinct from the decorative outline.
- All orange emphasis, selected washes, gradients and glows become `theme.accent.*`. Extra accent roles describe intensity/material, not a screen. Orange keeps each existing rendered Stitch shade. Other accents use their corresponding existing palette steps.
- Status has ordinary fills, opaque text-bearing fills, strong fills and container/on-container roles. These are shared across screens, not feature palettes.
- Fixed photo workspace becomes `workspace.*`, with all eight values unchanged. Scrim/glass/map remain shared roles. Unused screen palette leaves are deleted instead of inventing unused roles.
- Target: every direct redesign binding remains **value unchanged** for default orange in Light/Dark; non-orange changes are accent-following only. Legacy shared roles are replaced by Stitch. Any existing redesigned consumer of an old shared role must be disclosed below; a token rename alone is not proof that the whole screen is pixel-identical.

## Old screen palette → role (Stitch values)

Values below are from base, not the rejected branch. `Deleted` means no live component reads it (unused TextColor resolver entries are removed too).

| Old key (both modes) | Shared role | Light | Dark | Direct binding result |
| --- | --- | --- | --- | --- |
| `redesign*.savedCanvas` | `surface.inset` | `#FAF7F2` | `#181715` | value unchanged |
| `redesign*.savedLine` | Deleted | `#E5E5E5` | `#333333` | unused |
| `redesign*.savedMuted` | Deleted | `#737373` | `#CCCCCC` | unused |
| `redesign*.savedChip` | Deleted | `#F5F5F5` | `#2A2A2A` | unused |
| `redesign*.savedCount` | `surface.disabled` | `#E5E5E5` | `#333333` | value unchanged |
| `redesign*.savedAccentSoft` | Deleted | `#FDF4F2` | `#2A2A2A` | unused |
| `redesign*.savedAccent` | `accent.textMuted` | `#B82F15` | `#FF746C` | value unchanged; follows accent |
| `redesign*.savedGoogleFill` | Deleted | `#FFFBEB` | `#392C18` | unused |
| `redesign*.savedGoogleText` | Deleted | `#92400E` | `#FDE68A` | unused |
| `redesign*.savedGoogleLine` | Deleted | `#FDE68A` | `#69502B` | unused |
| `redesign*.savedPhotoScrim` | Deleted | `rgba(0,0,0,0.6)` | `rgba(0,0,0,0.6)` | unused |
| `redesign*.savedOpenDot` | Deleted | `#34D399` | `#34D399` | unused |
| `redesign*.importInputCanvas` | `surface.inset` | `#FAF7F2` | `#181715` | value unchanged |
| `redesign*.importInputLine` | `border.neutral` | `#E5E5E5` | `#333333` | value unchanged |
| `redesign*.importInputDim` | `surface.muted` | `#F3EEE7` | `#2A2A2A` | value unchanged |
| `redesign*.importInputPrimary` | `accent.primaryMuted` | `#C2351D` | `#CA381F` | value unchanged; follows accent |
| `redesign*.importSyncedFill` | `status.successContainer` | `#9EF5C0` | `#16402F` | value unchanged |
| `redesign*.importSyncedText` | `status.onSuccessContainer` | `#002111` | `#A7E8CD` | value unchanged |
| `redesign*.importPhotoBadgeText` | Deleted | `#C0FFD6` | `#C0FFD6` | unused |
| `redesign*.verifiedFill` | `status.successStrongFill` | `#247D52` | `#247D52` | value unchanged |
| `redesign*.primaryFill` | `accent.primary` | `#CA381F` | `#CA381F` | value unchanged; follows accent |
| `redesign*.primaryText` | `accent.text` / `accent.onSoft` on selected washes | `#A71E07` | `#FF746C` | value unchanged; follows accent |
| `redesign*.heroStart` | `accent.gradientStart` | `#FFE8E2` | `#2A2A2A` | value unchanged; follows accent |
| `redesign*.heroMiddle` | `accent.gradientMiddle` | `#FFF3EE` | `#222222` | value unchanged; follows accent |
| `redesign*.heroEnd` | `status.infoGradient` | `#EAE6FE` | `#2F2A55` | value unchanged |
| `redesign*.canvas` | `surface.canvas` | `#FFF8F3` | `#181715` | value unchanged |
| `redesign*.card` | `surface.card` | `#FFFFFF` | `#222222` | value unchanged |
| `redesign*.low` | `surface.low` | `#F9F2ED` | `#2A2A2A` | value unchanged |
| `redesign*.container` | `surface.container` | `#F3EDE8` | `#2A2A2A` | value unchanged |
| `redesign*.high` | `surface.high` | `#EDE7E2` | `#333333` | value unchanged |
| `redesign*.highest` | `surface.highest` | `#E7E1DC` | `#333333` | value unchanged |
| `redesign*.dim` | `surface.dim` | `#DFD9D4` | `#333333` | value unchanged |
| `redesign*.ink` | `text.primary` | `#1D1B18` | `#E6E6E6` | value unchanged |
| `redesign*.secondary` | `text.secondary` | `#5A413B` | `#CCCCCC` | value unchanged |
| `redesign*.outline` | `border.outline` | `#8E706A` | `#999999` | value unchanged |
| `redesign*.line` | `border.hairline` | `#E3BEB7` | `#333333` | value unchanged |
| `redesign*.checklistUnmet` | `text.supporting` | `#8A6C66` | `#999999` | value unchanged |
| `redesign*.recommendationFill` | `status.successFill` | `#237C51` | `#3B8365` | value unchanged |
| `redesign*.mutedTitle` | `text.neutralPrimary` | `#211F1C` | `#E6E6E6` | value unchanged |
| `redesign*.mutedBody` | `text.neutralSecondary` | `#746E68` | `#CCCCCC` | value unchanged |
| `redesign*.primary` | `accent.primaryDeep` | `#A71E07` | `#A72E19` | value unchanged; follows accent |
| `redesign*.primarySoft` | `accent.container` | `#FFDAD3` | `#2A2A2A` | value unchanged; follows accent |
| `redesign*.moodSelected` | `accent.selected` | `#FFE3DA` | `#472C25` | value unchanged; follows accent |
| `redesign*.violet` | `status.info` | `#7161E2` | `#7161E2` | value unchanged |
| `redesign*.violetText` | `status.infoText` | `#5747C8` | `#C7BFFF` | value unchanged |
| `redesign*.violetSoft` | `status.infoSoft` | `#E4DFFF` | `#2F2A55` | value unchanged |
| `redesign*.violetInk` | `status.infoInk` | `#170065` | `#C7BFFF` | value unchanged |
| `redesign*.green` | `status.success` | `#237C51` | `#4FAF86` | unused |
| `redesign*.greenText` | `status.successText` | `#00623C` | `#A7E8CD` | value unchanged |
| `redesign*.greenSoft` | `status.successSoft` | `#ECFFF3` | `#16402F` | value unchanged |
| `redesign*.white` | `text.inverse` | `#FFFFFF` | `#FFFFFF` | value unchanged |
| `redesign*.bubble` | `glass.opaque` | `rgba(255,255,255,0.95)` | `rgba(34,34,34,0.95)` | value unchanged |
| `redesign*.panel` | `glass.translucent` | `rgba(255,255,255,0.90)` | `rgba(34,34,34,0.90)` | value unchanged |
| `redesign*.header` | `glass.header` | `rgba(255,248,243,0.85)` | `rgba(24,23,21,0.85)` | value unchanged |
| `redesign*.scrimStart` | `overlay.gradientStrong` | `rgba(50,48,45,0.80)` | `rgba(50,48,45,0.80)` | value unchanged |
| `redesign*.scrimMiddle` | `overlay.gradientLight` | `rgba(50,48,45,0.20)` | `rgba(50,48,45,0.20)` | value unchanged |
| `redesign*.clear` | `overlay.clear` | `rgba(50,48,45,0)` | `rgba(50,48,45,0)` | value unchanged |
| `redesign*.glowWarm` | `accent.glow` | `#FFDAD3` | `#FF746C` | value unchanged; follows accent |
| `redesign*.glowCool` | `status.info` | `#7161E2` | `#7161E2` | value unchanged |
| `redesign*.glowGreen` | `status.success` | `#237C51` | `#4FAF86` | value unchanged |

## Per-file direct redesign inventory

Every row confirms **value unchanged** for the mapped direct palette bindings in both default-orange modes. This is the pre-edit contract; automated pins will verify it after migration. Shared legacy roles are audited separately.

| Redesign view/style | Keys | Result |
| --- | --- | --- |
| `src/shared/administrative/administrative-picker.view.tsx` | primaryText, secondary | value unchanged; accent-following in other themes |
| `src/shared/administrative/administrative-picker.style.tsx` | low | value unchanged |
| `src/shared/ui/chip.style.tsx` | card, low, primarySoft, moodSelected | value unchanged; accent-following in other themes |
| `src/shared/ui/header-notification-button.view.tsx` | primaryText | value unchanged; accent-following in other themes |
| `src/shared/ui/unavailable-action.view.tsx` | outline | value unchanged |
| `src/shared/ui/search-field.view.tsx` | secondary | value unchanged |
| `src/shared/ui/header-notification-button.style.tsx` | primaryFill | value unchanged; accent-following in other themes |
| `src/shared/ui/rating-chips.view.tsx` | ink, violetText | value unchanged |
| `src/shared/ui/badge.style.tsx` | low, recommendationFill, violetSoft, bubble | value unchanged |
| `src/shared/ui/card.style.tsx` | card, low | value unchanged |
| `src/shared/location/current-area-sheet.style.tsx` | high | value unchanged |
| `src/app/(tabs)/_layout.tsx` | ink, secondary | value unchanged |
| `src/shared/ui/info-banner.style.tsx` | card, greenText | value unchanged |
| `src/shared/ui/password-requirements.view.tsx` | checklistUnmet, greenText | value unchanged |
| `src/shared/ui/button.style.tsx` | low, high | value unchanged |
| `src/shared/ui/labelled-input.view.tsx` | ink, outline | value unchanged |
| `src/shared/ui/ambient-glow.view.tsx` | primary, violetText, violetSoft, glowWarm, glowCool, glowGreen | value unchanged; accent-following in other themes |
| `src/shared/ui/chip.view.tsx` | primaryText, secondary | value unchanged; accent-following in other themes |
| `src/shared/ui/rating-chips.style.tsx` | container, violetSoft | value unchanged |
| `src/shared/ui/segmented-control.view.tsx` | ink, secondary | value unchanged |
| `src/shared/ui/button.view.tsx` | primaryText, ink, secondary | value unchanged; accent-following in other themes |
| `src/shared/ui/frosted-material.style.tsx` | canvas, card, bubble, panel, header | value unchanged |
| `src/shared/ui/search-field.style.tsx` | high, ink | value unchanged |
| `src/shared/ui/material-icon.tsx` | ink | value unchanged |
| `src/shared/ui/place-card.style.tsx` | verifiedFill, card, container, greenText, scrimStart | value unchanged |
| `src/shared/ui/info-banner.view.tsx` | ink, secondary, outline, violetText | value unchanged |
| `src/shared/ui/badge.view.tsx` | secondary, violetInk, greenText, white | value unchanged |
| `src/shared/ui/segmented-control.style.tsx` | card, container | value unchanged |
| `src/shared/ui/labelled-input.style.tsx` | card, low, ink | value unchanged |
| `src/shared/ui/sheet.style.tsx` | card, highest | value unchanged |
| `src/shared/ui/primitives.tsx` | canvas, low, highest, dim, line, primary | value unchanged; accent-following in other themes |
| `src/features/tabs/saved-city.style.tsx` | savedCanvas, savedCount, primaryFill | value unchanged; accent-following in other themes |
| `src/features/tabs/profile.style.tsx` | container, primarySoft, violet, violetSoft | value unchanged; accent-following in other themes |
| `src/features/tabs/profile.view.tsx` | primaryText, ink, secondary, violetText | value unchanged; accent-following in other themes |
| `src/features/tabs/saved-city.view.tsx` | savedAccent, primaryText | value unchanged; accent-following in other themes |
| `src/features/tabs/profile-upcoming.view.tsx` | violetText | value unchanged |
| `src/features/tabs/saved.view.tsx` | ink | value unchanged |
| `src/features/tabs/saved.style.tsx` | container, ink | value unchanged |
| `src/features/onboarding/splash-map.view.tsx` | ink, secondary, line, primarySoft, white | value unchanged; accent-following in other themes |
| `src/features/onboarding/onboarding.view.tsx` | ink, secondary, mutedTitle, mutedBody | value unchanged |
| `src/features/onboarding/onboarding-visual.view.tsx` | ink, secondary, outline, violetText, violetInk, greenText, white, scrimStart, scrimMiddle, clear | value unchanged |
| `src/features/onboarding/onboarding-visual.style.tsx` | low, container, high, primary, primarySoft, violet, violetText, violetSoft, greenSoft, panel | value unchanged; accent-following in other themes |
| `src/features/onboarding/splash.style.tsx` | canvas | value unchanged |
| `src/features/onboarding/splash.view.tsx` | ink | value unchanged |
| `src/features/notifications/notification-switch.style.tsx` | container | value unchanged |
| `src/features/notifications/notification-switch.view.tsx` | secondary | value unchanged |
| `src/features/place-import/import-photos.view.tsx` | ink, secondary | value unchanged |
| `src/features/place-import/contribution-wizard.style.tsx` | primaryText, card, low, container, highest, ink, line, primary, primarySoft | value unchanged; accent-following in other themes |
| `src/features/place-import/import-guide.view.tsx` | primaryText, ink, secondary, violetText, greenText | value unchanged; accent-following in other themes |
| `src/features/place-import/import.style.tsx` | importInputCanvas, importInputLine, importInputDim, importInputPrimary, importSyncedFill, primaryText, card, low, container, high, highest, line, primarySoft, violetSoft, greenSoft | value unchanged; accent-following in other themes |
| `src/features/place-import/existing-place-result.view.tsx` | ink, greenText | value unchanged |
| `src/features/place-import/contribution-choices.view.tsx` | primaryText | value unchanged; accent-following in other themes |
| `src/features/place-import/contribution-wizard.view.tsx` | primaryText, secondary, outline | value unchanged; accent-following in other themes |
| `src/features/place-import/import.view.tsx` | importSyncedText, primaryText, ink, secondary, outline, greenText | value unchanged; accent-following in other themes |
| `src/features/account/theme-accent.view.tsx` | ink, secondary | value unchanged |
| `src/features/account/profile-defaults.style.tsx` | low, container, outline, primarySoft, violetSoft | value unchanged; accent-following in other themes |
| `src/features/account/date-of-birth.style.tsx` | outline | value unchanged |
| `src/features/account/account.view.tsx` | primaryText | value unchanged; accent-following in other themes |
| `src/features/account/theme-accent.style.tsx` | card, low, container | value unchanged |
| `src/features/account/profile-defaults.view.tsx` | primaryText, ink, secondary, violetText | value unchanged; accent-following in other themes |
| `src/features/account/account.style.tsx` | outline | value unchanged |
| `src/features/search/search-empty.view.tsx` | primaryText, ink, secondary, violetText, greenText | value unchanged; accent-following in other themes |
| `src/features/search/search-map-panel.style.tsx` | canvas, card | value unchanged |
| `src/features/search/search.style.tsx` | primaryFill, canvas, card, low, container, high, ink, line, primarySoft, violetSoft | value unchanged; accent-following in other themes |
| `src/features/search/search.view.tsx` | primaryText, ink, secondary, violetText | value unchanged; accent-following in other themes |
| `src/features/auth/sign-in.view.tsx` | ink, secondary, outline | value unchanged |
| `src/features/home/quick-join.view.tsx` | secondary, violetText | value unchanged |
| `src/features/home/home.style.tsx` | card, container, high, ink, primary, violet, violetText, violetSoft | value unchanged; accent-following in other themes |
| `src/features/home/home.view.tsx` | primaryText, heroStart, heroMiddle, heroEnd, secondary, violetText, white | value unchanged; accent-following in other themes |
| `src/features/settings/location-permission.style.tsx` | low, container | value unchanged |
| `src/features/settings/location-permission.view.tsx` | secondary | value unchanged |
| `src/features/settings/permissions.view.tsx` | secondary, violetText | value unchanged |
| `src/features/settings/permissions.style.tsx` | container, violetSoft | value unchanged |

## Old shared role migration

`surface.canvas/card/subtle` → Stitch canvas/card/container; `text.primary/secondary/tertiary` and `colors.neutral[900/500/300]` → Stitch ink/secondary/outline; `border.hairline` → Stitch line; status success/info variants → Stitch redesign status roles. The old palette cannot override these shared roles. Map labels/strokes and glass hairlines also take their referenced shared role. Workspace geometry and non-colour tokens stay unchanged. Full before/after values and affected legacy consumers are appended after verification.

## Verification — historical pre-rebase run

Baseline: 130/130 contrast/theme tests pass (`/tmp/556r2-baseline-contrast.log`). Final results on the local patch over `f28f617`:

| Check | Result | Log |
| --- | --- | --- |
| `pnpm typecheck` | PASS, exit 0 | `/tmp/556r2-typecheck.log` |
| `pnpm lint` | PASS, exit 0, no warnings/errors | `/tmp/556r2-lint.log` |
| `pnpm test` | Exit 1: 1,672 pass; 3 explicit source-AA expected failures; 39 skip; only the 3 known sandbox `distribute-wrapper` failures at lines 208/234/258 | `/tmp/556r2-test.log` |
| `pnpm test:ui --runInBand` | PASS, exit 0: 209 suites, 2,831 tests | `/tmp/556r2-test-ui.log` |
| 4 accents × Light/Dark actual style/render sample | PASS: 32 cases; real import/wizard/saved/home/notification factories and rendered selected chips | `/tmp/556r2-accent-sample.log` and final UI log |
| Old-palette regression probe | PASS: temporarily reverting the canvas to old ivory makes the Stitch pin test fail (exit 1); source restored in `finally` | `/tmp/556r2-old-palette-rejection.log` |
| Expo resolved configuration | PASS, exit 0: shared token colours resolve under Node 22 | `/tmp/556r2-expo-config.log` |
| Non-colour token preservation | PASS: exported fontFamily/type/glyph/glyphText/fill/spacing/radius/motion/buttonSizes/touchTarget/hitSlop equal baseline | local exported-value audit |
| `git diff --check` | PASS | local check |

47 live direct redesign colour roles are pinned to independently captured pre-edit values in both orange modes; all 73 affected view/style binding inventories match. Fixed workspace has eight independent exact-value pins. Role vocabulary rejects feature names even under allowed groups; the production scan rejects removed palette imports/member reads and colour literals, including in `theme.ts` and native launch configuration. No process-lock test was edited or skipped.

Historical result: positive AA tests retained their thresholds and three expected failures exposed the then-authoritative Stitch deficits. These three exceptions are now resolved by the owner 2026-11-10 decision below. Automated proof covers values/bindings/render output, not simulator screenshots or native visual acceptance. No build, commit or push.

## Shared roles that change from the legacy palette

These changes propagate through existing consumers, including redesigned screens still using legacy roles. **Zero change is proven for direct redesign bindings, not for those inherited legacy colours.** No existing Stitch redesign colour was moved toward the old palette. This is the explicit app-wide consequence of making the Stitch role authoritative. Shadow ink keeps the existing Stitch neutral ink.

| Shared role | Light before → Stitch | Dark before → Stitch |
| --- | --- | --- |
| `accent.text` | `#CA381F` → `#A71E07` | `#FF746C` → `#FF746C` |
| `accent.onSoft` | `#A72E19` → `#A71E07` | `#FF746C` → `#FF746C` |
| `surface.canvas` | `#F6F3EE` → `#FFF8F3` | `#181715` → `#181715` |
| `surface.subtle` | `#ECE8E1` → `#F3EDE8` | `#2A2A2A` → `#2A2A2A` |
| `border.hairline` | `#ECE8E1` → `#E3BEB7` | `#333333` → `#333333` |
| `text.primary` | `#211F1C` → `#1D1B18` | `#E6E6E6` → `#E6E6E6` |
| `text.secondary` | `#746E68` → `#5A413B` | `#CCCCCC` → `#CCCCCC` |
| `text.tertiary` | `#C8C1B8` → `#8E706A` | `#999999` → `#999999` |
| `status.success` | `#4FAF86` → `#237C51` | `#4FAF86` → `#4FAF86` |
| `status.successSoft` | `#D9F3E7` → `#ECFFF3` | `#16402F` → `#16402F` |
| `status.successText` | `#35765B` → `#00623C` | `#A7E8CD` → `#A7E8CD` |
| `status.warningSoft` | `#FCEBCB` → `#FBEBD3` | `#3D2E0B` → `#3D2E0B` |
| `status.danger` | `#C84455` → `#CC4B46` | `#FF6B6B` → `#FF6B6B` |
| `status.dangerSoft` | `#FADDE2` → `#FBE3E2` | `#4A1A20` → `#4A1A20` |
| `status.info` | `#7667E8` → `#7161E2` | `#7B8CFF` → `#7161E2` |
| `status.infoSoft` | `#E5E0FF` → `#E4DFFF` | `#2F2A55` → `#2F2A55` |
| `status.infoText` | `#5F4FD1` → `#5747C8` | `#A99DF5` → `#C7BFFF` |
| `map.label` | `#746E68` → `#5A413B` | `#CCCCCC` → `#CCCCCC` |
| `map.labelStroke` | `#F6F3EE` → `#FFF8F3` | `#222222` → `#222222` |
| `glass.bar.hairline` | `#ECE8E1` → `#E3BEB7` | `rgba(51,51,51,0.7)` → `rgba(51,51,51,0.7)` |

### Existing redesigned flows with inherited colour changes

The direct bindings in the earlier per-file table remain value unchanged. However, shared `Text` defaults, canvas, subtle fills, borders, status pills, map labels and legacy `accent.primary` text references now resolve to the authoritative Stitch roles. This includes Splash/Onboarding/auth shared controls; Home/quick-join; Search/filter/place details; Saved/city; import/contribution flows; Profile/account/defaults/theme/permissions/notification controls; and the new group 09 assistant (gate, welcome, conversation, proposal, history). This migration **does not claim zero whole-screen colour change** on those flows: inherited pre-redesign colours also shift. Orange text/selected/gradient shifts from legacy accent roles are accent-only.

### Non-redesigned flows that change

- Create-date wizard: mode, location, budget, time, mood, group-mode, date-time picker, draft resume/exit, save draft and shared actions.
- Matching: preference, finding, swipe, results, quick-choice and their shared dialog/card/chip states.
- Rooms: invite/expired/unavailable links, guest entry/replacement, pair/group waiting rooms, lobby, invite/share, manage/schedule/edit-name panels.
- Date planning and live date: itinerary, check-in, active-date panels, plan warnings, route alternatives and exit confirmations.
- Reviews and shared results: review form, sent/done/result states, feedback cards and photo permission panels.
- Global offline/update/permission/error/skeleton/toast/dialog/sheet surfaces inherit the same role changes wherever used.

Exact direct legacy consumers (source references captured before migration; shared defaults also propagate to callers without explicit colour props):

| File | Changed shared roles |
| --- | --- |
| `src/app/(tabs)/_layout.tsx` | `accent.text`, `text.secondary` |
| `src/app/_layout.tsx` | `surface.canvas` |
| `src/features/account/account.style.tsx` | `surface.canvas`, `surface.subtle`, `text.primary`, `text.secondary`, `status.danger` |
| `src/features/account/account.view.tsx` | `text.secondary` |
| `src/features/account/avatar-source-sheet.view.tsx` | `text.secondary` |
| `src/features/account/birthday-sheet.style.tsx` | `surface.subtle`, `border.hairline` |
| `src/features/account/birthday-sheet.view.tsx` | `text.primary`, `text.secondary` |
| `src/features/account/date-of-birth.style.tsx` | `surface.subtle`, `text.primary` |
| `src/features/account/date-of-birth.view.tsx` | `accent.onSoft`, `text.primary`, `text.secondary` |
| `src/features/account/profile-defaults.style.tsx` | `accent.onSoft` |
| `src/features/account/profile-defaults.view.tsx` | `accent.onSoft`, `text.secondary` |
| `src/features/account/theme-accent.style.tsx` | `surface.subtle` |
| `src/features/account/theme-accent.view.tsx` | `accent.onSoft`, `text.secondary` |
| `src/features/active-date/active-date.style.tsx` | `surface.subtle`, `status.success` |
| `src/features/active-date/active-date.view.tsx` | `text.secondary` |
| `src/features/active-date/checkin-sheet.style.tsx` | `accent.onSoft`, `surface.subtle`, `border.hairline`, `text.primary`, `text.secondary`, `status.success`, `status.successSoft`, `status.successText`, `status.danger` |
| `src/features/active-date/checkin-sheet.view.tsx` | `text.secondary` |
| `src/features/active-date/date-finished.style.tsx` | `surface.subtle`, `border.hairline`, `status.success`, `status.successSoft` |
| `src/features/active-date/date-finished.view.tsx` | `text.secondary`, `status.successText` |
| `src/features/assistant/answer-blocks.style.tsx` | `text.secondary` |
| `src/features/assistant/answer-blocks.view.tsx` | `accent.onSoft` |
| `src/features/assistant/assistant-avatar.view.tsx` | `accent.onSoft` |
| `src/features/assistant/assistant-coachmark.style.tsx` | `text.primary` |
| `src/features/assistant/assistant-fab.style.tsx` | `surface.canvas` |
| `src/features/assistant/assistant-message.view.tsx` | `text.secondary` |
| `src/features/assistant/assistant-place-card.style.tsx` | `surface.subtle` |
| `src/features/assistant/assistant-place-card.view.tsx` | `accent.onSoft`, `text.secondary` |
| `src/features/assistant/assistant-reply.style.tsx` | `surface.subtle` |
| `src/features/assistant/assistant-reply.view.tsx` | `text.secondary` |
| `src/features/assistant/assistant.style.tsx` | `surface.canvas` |
| `src/features/assistant/composer.style.tsx` | `surface.subtle`, `border.hairline`, `text.primary`, `text.secondary` |
| `src/features/assistant/composer.view.tsx` | `text.primary`, `text.secondary` |
| `src/features/assistant/confirmation-card.view.tsx` | `accent.onSoft`, `text.secondary`, `status.successText` |
| `src/features/assistant/conversation.view.tsx` | `text.secondary` |
| `src/features/assistant/follow-ups.view.tsx` | `text.secondary` |
| `src/features/assistant/history-item.view.tsx` | `accent.onSoft`, `text.secondary` |
| `src/features/assistant/history.style.tsx` | `surface.subtle`, `border.hairline`, `text.primary` |
| `src/features/assistant/history.view.tsx` | `text.primary`, `text.secondary` |
| `src/features/assistant/info-rows.style.tsx` | `surface.subtle` |
| `src/features/assistant/info-rows.view.tsx` | `text.secondary` |
| `src/features/assistant/offline-banner.style.tsx` | `status.danger`, `status.dangerSoft` |
| `src/features/assistant/proposal-edit.style.tsx` | `border.hairline`, `text.primary` |
| `src/features/assistant/proposal-edit.view.tsx` | `text.secondary` |
| `src/features/assistant/result-card.view.tsx` | `accent.onSoft`, `text.secondary` |
| `src/features/assistant/sign-in-prompt.style.tsx` | `surface.subtle` |
| `src/features/assistant/sign-in-prompt.view.tsx` | `text.secondary`, `status.successText` |
| `src/features/assistant/source-list.style.tsx` | `surface.subtle`, `border.hairline` |
| `src/features/assistant/source-list.view.tsx` | `accent.onSoft`, `text.secondary` |
| `src/features/assistant/state-notice.style.tsx` | `status.success`, `status.successSoft`, `status.danger`, `status.dangerSoft`, `status.info`, `status.infoSoft` |
| `src/features/assistant/state-notice.view.tsx` | `text.secondary`, `status.successText`, `status.infoText` |
| `src/features/assistant/suggestion-card.style.tsx` | `surface.subtle` |
| `src/features/assistant/suggestion-card.view.tsx` | `accent.onSoft`, `text.primary`, `text.secondary` |
| `src/features/assistant/task-summary.style.tsx` | `status.success`, `status.successText` |
| `src/features/assistant/typing-indicator.view.tsx` | `text.secondary` |
| `src/features/assistant/user-message.style.tsx` | `surface.subtle` |
| `src/features/assistant/user-message.view.tsx` | `text.primary`, `text.secondary` |
| `src/features/assistant/welcome.view.tsx` | `text.secondary` |
| `src/features/contributions/my-contributions.style.tsx` | `border.hairline`, `status.danger`, `status.dangerSoft` |
| `src/features/contributions/my-contributions.view.tsx` | `text.secondary`, `status.successText` |
| `src/features/create-date/create-budget.style.tsx` | `surface.subtle` |
| `src/features/create-date/create-budget.view.tsx` | `accent.onSoft`, `text.primary`, `text.secondary` |
| `src/features/create-date/create-location.view.tsx` | `accent.onSoft`, `text.secondary` |
| `src/features/create-date/create-mood.view.tsx` | `text.secondary` |
| `src/features/create-date/create-time.style.tsx` | `surface.subtle`, `border.hairline`, `status.danger`, `status.dangerSoft` |
| `src/features/create-date/create-time.view.tsx` | `accent.onSoft`, `text.primary`, `text.secondary` |
| `src/features/create-date/create-type.style.tsx` | `surface.subtle`, `border.hairline`, `text.primary` |
| `src/features/create-date/create-type.view.tsx` | `accent.onSoft`, `text.primary`, `text.secondary` |
| `src/features/create-date/date-time-sheet.style.tsx` | `surface.subtle`, `status.danger`, `status.dangerSoft` |
| `src/features/create-date/date-time-sheet.view.tsx` | `accent.onSoft`, `text.primary`, `text.secondary` |
| `src/features/create-date/group-setup.style.tsx` | `surface.subtle`, `border.hairline` |
| `src/features/create-date/group-setup.view.tsx` | `accent.onSoft`, `text.primary`, `text.secondary` |
| `src/features/create-date/wizard-step.style.tsx` | `surface.subtle` |
| `src/features/date-plan/date-plan.style.tsx` | `surface.canvas`, `surface.subtle`, `border.hairline`, `status.warningSoft` |
| `src/features/date-plan/date-plan.view.tsx` | `text.primary`, `text.secondary`, `status.successText` |
| `src/features/date-plan/place-detail-empty-hero.view.tsx` | `surface.subtle`, `text.secondary` |
| `src/features/date-plan/place-detail.style.tsx` | `surface.subtle`, `border.hairline`, `text.tertiary`, `status.success`, `status.info`, `status.infoSoft` |
| `src/features/date-plan/place-detail.view.tsx` | `text.secondary`, `status.successText` |
| `src/features/date-plan/place-report.style.tsx` | `surface.subtle`, `text.primary` |
| `src/features/date-plan/place-reviews.style.tsx` | `surface.subtle`, `border.hairline`, `status.success`, `status.successSoft` |
| `src/features/date-plan/place-reviews.view.tsx` | `text.primary`, `text.secondary`, `status.successText` |
| `src/features/date-plan/plan-change.style.tsx` | `surface.subtle` |
| `src/features/date-plan/plan-change.view.tsx` | `text.secondary` |
| `src/features/date-plan/plan-edit.style.tsx` | `surface.canvas`, `surface.subtle`, `border.hairline` |
| `src/features/date-plan/plan-edit.view.tsx` | `text.secondary` |
| `src/features/deep-link/share-link.style.tsx` | `accent.onSoft`, `surface.subtle`, `status.warningSoft`, `status.danger`, `status.dangerSoft`, `status.info`, `status.infoSoft` |
| `src/features/deep-link/share-link.view.tsx` | `text.secondary`, `status.infoText` |
| `src/features/gogo-room/gogo-room.style.tsx` | `surface.canvas`, `surface.subtle`, `text.tertiary`, `status.success`, `status.successSoft`, `status.warningSoft`, `status.info`, `status.infoSoft` |
| `src/features/gogo-room/gogo-room.view.tsx` | `text.secondary`, `status.success`, `status.successText`, `status.info`, `status.infoText` |
| `src/features/gogo-room/guest-join.style.tsx` | `surface.subtle`, `text.primary`, `status.danger`, `status.dangerSoft` |
| `src/features/gogo-room/guest-join.view.tsx` | `text.secondary`, `status.successText` |
| `src/features/gogo-room/invite-expired.view.tsx` | `text.secondary` |
| `src/features/gogo-room/join-by-code.style.tsx` | `surface.subtle`, `text.primary`, `status.danger`, `status.dangerSoft` |
| `src/features/gogo-room/join-by-code.view.tsx` | `text.secondary` |
| `src/features/gogo-room/room-manage.style.tsx` | `surface.subtle`, `border.hairline`, `text.primary`, `status.warningSoft`, `status.danger`, `status.dangerSoft` |
| `src/features/gogo-room/room-manage.view.tsx` | `text.secondary` |
| `src/features/gogo-room/room-schedule-editor.view.tsx` | `text.secondary` |
| `src/features/gogo-room/room-title-editor.view.tsx` | `text.secondary` |
| `src/features/home/home.style.tsx` | `surface.subtle`, `border.hairline` |
| `src/features/home/home.view.tsx` | `text.secondary` |
| `src/features/matching/match-result.style.tsx` | `surface.subtle` |
| `src/features/matching/match-result.view.tsx` | `accent.onSoft`, `text.secondary` |
| `src/features/matching/matching-orbit.view.tsx` | `accent.onSoft` |
| `src/features/matching/matching.style.tsx` | `surface.canvas`, `surface.subtle`, `border.hairline` |
| `src/features/matching/matching.view.tsx` | `accent.onSoft`, `text.primary`, `text.secondary` |
| `src/features/matching/preference.style.tsx` | `border.hairline` |
| `src/features/matching/preference.view.tsx` | `accent.onSoft`, `text.secondary` |
| `src/features/matching/suggestion-run-notice.view.tsx` | `text.secondary` |
| `src/features/matching/swipe.style.tsx` | `surface.subtle`, `border.hairline` |
| `src/features/matching/swipe.view.tsx` | `text.primary`, `text.secondary`, `status.success`, `status.danger`, `status.info` |
| `src/features/notifications/notification-switch.view.tsx` | `accent.onSoft`, `surface.subtle`, `text.primary`, `text.secondary`, `status.successText` |
| `src/features/notifications/notifications.style.tsx` | `surface.subtle` |
| `src/features/notifications/notifications.view.tsx` | `accent.onSoft`, `text.secondary` |
| `src/features/place-import/contribution-wizard.style.tsx` | `status.success` |
| `src/features/place-import/import-photos.view.tsx` | `text.secondary` |
| `src/features/place-import/import.style.tsx` | `surface.subtle`, `border.hairline`, `text.primary`, `status.success`, `status.successSoft`, `status.successText`, `status.warningSoft`, `status.danger`, `status.dangerSoft` |
| `src/features/place-import/import.view.tsx` | `text.secondary` |
| `src/features/review/my-reviews.style.tsx` | `surface.canvas`, `border.hairline`, `text.primary`, `status.info`, `status.infoSoft` |
| `src/features/review/my-reviews.view.tsx` | `text.secondary`, `status.infoText` |
| `src/features/review/review.style.tsx` | `surface.canvas`, `surface.subtle`, `border.hairline`, `text.primary`, `status.success`, `status.successSoft`, `status.warningSoft` |
| `src/features/review/review.view.tsx` | `accent.onSoft`, `text.secondary` |
| `src/features/review/shared-result.style.tsx` | `surface.canvas`, `surface.subtle`, `border.hairline` |
| `src/features/review/shared-result.view.tsx` | `text.primary` |
| `src/features/settings/device-promotions.view.tsx` | `surface.subtle`, `text.secondary` |
| `src/features/settings/location-permission.view.tsx` | `accent.onSoft`, `text.primary`, `text.secondary` |
| `src/features/settings/settings-page.view.tsx` | `text.secondary` |
| `src/features/settings/tracking-consent.view.tsx` | `surface.subtle`, `text.secondary` |
| `src/features/tabs/profile-upcoming.view.tsx` | `text.secondary` |
| `src/features/tabs/profile.style.tsx` | `surface.canvas`, `surface.subtle`, `border.hairline` |
| `src/features/tabs/profile.view.tsx` | `text.secondary` |
| `src/features/tabs/saved-city.view.tsx` | `text.secondary` |
| `src/features/tabs/saved-link.view.tsx` | `text.secondary` |
| `src/features/tabs/saved.style.tsx` | `surface.subtle` |
| `src/features/tabs/saved.view.tsx` | `text.secondary`, `status.successText` |
| `src/shared/administrative/administrative-picker.style.tsx` | `border.hairline` |
| `src/shared/administrative/administrative-picker.view.tsx` | `text.primary`, `text.secondary` |
| `src/shared/consent/tracking-sheet.style.tsx` | `border.hairline` |
| `src/shared/consent/tracking-sheet.view.tsx` | `text.secondary` |
| `src/shared/location/current-area-sheet.view.tsx` | `text.secondary` |
| `src/shared/media/media-permission-sheet.view.tsx` | `text.secondary` |
| `src/shared/notifications/device-promotions-sheet.style.tsx` | `border.hairline` |
| `src/shared/notifications/device-promotions-sheet.view.tsx` | `text.secondary` |
| `src/shared/observability/root-error-boundary.style.tsx` | `surface.canvas` |
| `src/shared/ui/app-header.style.tsx` | `surface.canvas`, `surface.subtle` |
| `src/shared/ui/app-header.view.tsx` | `text.primary`, `text.secondary` |
| `src/shared/ui/async-state.style.tsx` | `status.warningSoft` |
| `src/shared/ui/async-state.view.tsx` | `text.secondary` |
| `src/shared/ui/badge.style.tsx` | `surface.subtle`, `text.secondary`, `status.success`, `status.successSoft`, `status.successText`, `status.warningSoft`, `status.danger`, `status.dangerSoft`, `status.info`, `status.infoSoft`, `status.infoText` |
| `src/shared/ui/badge.view.tsx` | `accent.onSoft`, `text.primary`, `status.successText`, `status.infoText` |
| `src/shared/ui/button.style.tsx` | `surface.subtle`, `border.hairline`, `status.danger`, `status.dangerSoft` |
| `src/shared/ui/button.view.tsx` | `text.primary`, `text.secondary`, `status.danger` |
| `src/shared/ui/chip.style.tsx` | `surface.subtle`, `border.hairline`, `status.success`, `status.successSoft`, `status.warningSoft`, `status.info`, `status.infoSoft` |
| `src/shared/ui/chip.view.tsx` | `accent.onSoft`, `text.primary`, `text.secondary`, `status.successText`, `status.infoText` |
| `src/shared/ui/count-badge.style.tsx` | `surface.canvas`, `status.success`, `status.successSoft`, `status.successText` |
| `src/shared/ui/count-badge.view.tsx` | `status.successText` |
| `src/shared/ui/dialog.view.tsx` | `text.secondary` |
| `src/shared/ui/filled-segmented-control.style.tsx` | `surface.subtle` |
| `src/shared/ui/filled-segmented-control.view.tsx` | `text.primary` |
| `src/shared/ui/glass-bar.style.tsx` | `glass.bar.hairline` |
| `src/shared/ui/icon-chip.style.tsx` | `status.danger`, `status.dangerSoft` |
| `src/shared/ui/icons.tsx` | `text.primary`, `text.secondary`, `status.success`, `status.successText` |
| `src/shared/ui/labelled-input.style.tsx` | `status.danger` |
| `src/shared/ui/map-canvas.style.tsx` | `border.hairline`, `map.label`, `map.labelStroke` |
| `src/shared/ui/map-canvas.view.tsx` | `text.primary`, `text.secondary`, `map.label` |
| `src/shared/ui/place-card.style.tsx` | `surface.subtle` |
| `src/shared/ui/place-card.view.tsx` | `text.primary`, `text.secondary`, `status.successText` |
| `src/shared/ui/place-photo.style.tsx` | `surface.subtle` |
| `src/shared/ui/place-photo.view.tsx` | `text.secondary` |
| `src/shared/ui/plan-card.style.tsx` | `surface.canvas`, `surface.subtle`, `border.hairline` |
| `src/shared/ui/plan-card.view.tsx` | `accent.onSoft`, `text.secondary` |
| `src/shared/ui/primitives.tsx` | `surface.canvas`, `surface.subtle`, `border.hairline` |
| `src/shared/ui/result-sheet.view.tsx` | `text.secondary`, `status.successText`, `status.infoText` |
| `src/shared/ui/room-connection-notice.style.tsx` | `surface.subtle`, `status.info`, `status.infoSoft` |
| `src/shared/ui/room-connection-notice.view.tsx` | `text.primary`, `text.secondary`, `status.info`, `status.infoText` |
| `src/shared/ui/search-field.style.tsx` | `border.hairline`, `text.primary` |
| `src/shared/ui/search-field.view.tsx` | `text.secondary` |
| `src/shared/ui/sheet-option-list.style.tsx` | `border.hairline` |
| `src/shared/ui/sheet-option-list.view.tsx` | `text.primary`, `text.secondary` |
| `src/shared/ui/sheet.style.tsx` | `surface.canvas`, `border.hairline` |
| `src/shared/ui/skeleton.style.tsx` | `surface.subtle` |
| `src/shared/ui/toast.style.tsx` | `text.primary` |

## Removed keys

- `redesignLight` and `redesignDark`: all 60 keys per mode (120 leaves), including all `saved*`, `import*`, `hero*`, `moodSelected`, `checklistUnmet`, `recommendationFill`; live ones map above, unused ones are deleted. No replacement feature palette.
- `theme.redesign` and all corresponding TextColor strings/resolver entries.
- `photoEditor` / `theme.photoEditor`: eight leaves renamed to fixed `workspace.canvas/surface/void/border/raised/emphasis/scrim/foreground`, exact values retained.
- `shadows.stitch` → `shadows.subtle` (same ink/geometry).
- The entire unused raw `colors.brand`/`colors.neutral` export and its `BrandColor`/`NeutralColor` aliases. Production already consumed roles; tests now do too.

## Source AA exceptions — resolved per owner 2026-11-10

Owner 2026-11-10 resolves all three former source-AA exceptions:

- Light `status.danger`: `#D84F4A` → `#CC4B46`; white on the solid fill now meets 4.5:1. Dark danger remains `#FF6B6B`.
- Onboarding small captions: `border.outline` (`#8E706A`) → `text.supporting` (`#8A6C66`) in Light, meeting 4.5:1 on both canvas and card. Dark supporting remains `#999999`, the same rendered value as the former caption binding.
- Decorative outline remains `#8E706A` / `#999999`. Border/icon roles are unchanged.

`contrast.test.ts` now uses ordinary passing AA assertions for danger and both caption backgrounds; there are no `it.fails` AA exceptions. Value pins and Onboarding render tests retain the owner-approved alternatives. Earlier verification sections below/above record historical runs before this owner decision and do not describe the current AA state.

Selected accent text uses `accent.onSoft` (same default-orange Stitch value as `accent.text`) on its container in all chip appearances. Other accents use their existing onSoft shade; using their ordinary link text on soft would fail AA (green 4.33, blue 4.16, purple 3.95), so the binding selects the correct foreground role instead of changing palette values.

## Exhaustive old colour leaf → shared token

This includes unchanged overlay, map and glass material leaves, and the removed raw palette. It provides a lookup for every old colour export. `Deleted` has no live production caller and creates no replacement colour. Numeric geometry/typography is excluded and verified byte-for-byte at the exported-value level.

| Old token | Before | Shared token | Stitch/current value |
| --- | --- | --- | --- |
| `colors.brand.lavender` | `#7667E8` | `status.info` | `#7161E2` |
| `colors.brand.lavenderSoft` | `#E5E0FF` | `status.infoSoft` | `#E4DFFF` |
| `colors.brand.lavenderGlass` | `rgba(118,103,232,0.78)` | Deleted | — |
| `colors.brand.mint` | `#4FAF86` | `status.success` | `#237C51` |
| `colors.brand.mintSoft` | `#D9F3E7` | `status.successSoft` | `#ECFFF3` |
| `colors.brand.amber` | `#D99028` | `status.warning` | `#D99028` |
| `colors.brand.amberSoft` | `#FCEBCB` | `status.warningSoft` | `#FBEBD3` |
| `colors.brand.red` | `#C84455` | `status.danger` | `#CC4B46` |
| `colors.brand.redSoft` | `#FADDE2` | `status.dangerSoft` | `#FBE3E2` |
| `colors.neutral.0` | `#FFFFFF` | `surface.card` | `#FFFFFF` |
| `colors.neutral.25` | `#FCFBF8` | Deleted | — |
| `colors.neutral.50` | `#F6F3EE` | `surface.canvas` | `#FFF8F3` |
| `colors.neutral.100` | `#ECE8E1` | `surface.container` | `#F3EDE8` |
| `colors.neutral.300` | `#C8C1B8` | `border.outline` | `#8E706A` |
| `colors.neutral.500` | `#746E68` | `text.secondary` | `#5A413B` |
| `colors.neutral.700` | `#4A4641` | `text.secondary` | `#5A413B` |
| `colors.neutral.900` | `#211F1C` | `text.primary` | `#1D1B18` |
| `surface.canvas` | `#F6F3EE` | `surface.canvas` | `#FFF8F3` |
| `surface.card` | `#FFFFFF` | `surface.card` | `#FFFFFF` |
| `surface.subtle` | `#ECE8E1` | `surface.subtle` | `#F3EDE8` |
| `border.hairline` | `#ECE8E1` | `border.hairline` | `#E3BEB7` |
| `text.primary` | `#211F1C` | `text.primary` | `#1D1B18` |
| `text.secondary` | `#746E68` | `text.secondary` | `#5A413B` |
| `text.tertiary` | `#C8C1B8` | `text.tertiary` | `#8E706A` |
| `text.inverse` | `#FFFFFF` | `text.inverse` | `#FFFFFF` |
| `onAccent` | `#FFFFFF` | `onAccent` | `#FFFFFF` |
| `status.success` | `#4FAF86` | `status.success` | `#237C51` |
| `status.successSoft` | `#D9F3E7` | `status.successSoft` | `#ECFFF3` |
| `status.successText` | `#35765B` | `status.successText` | `#00623C` |
| `status.warning` | `#D99028` | `status.warning` | `#D99028` |
| `status.warningSoft` | `#FCEBCB` | `status.warningSoft` | `#FBEBD3` |
| `status.warningText` | `#8F5F1A` | `status.warningText` | `#8F5F1A` |
| `status.danger` | `#C84455` | `status.danger` | `#CC4B46` |
| `status.dangerSoft` | `#FADDE2` | `status.dangerSoft` | `#FBE3E2` |
| `status.dangerText` | `#B43747` | `status.dangerText` | `#B43747` |
| `status.info` | `#7667E8` | `status.info` | `#7161E2` |
| `status.infoSoft` | `#E5E0FF` | `status.infoSoft` | `#E4DFFF` |
| `status.infoText` | `#5F4FD1` | `status.infoText` | `#5747C8` |
| `accents.orange.primary` | `#CA381F` | `accents.orange.primary` | `#CA381F` |
| `accents.orange.text` | `#CA381F` | `accents.orange.text` | `#A71E07` |
| `accents.orange.pressed` | `#A72E19` | `accents.orange.pressed` | `#A72E19` |
| `accents.orange.soft` | `#FFE3DA` | `accents.orange.soft` | `#FFE3DA` |
| `accents.orange.onSoft` | `#A72E19` | `accents.orange.onSoft` | `#A71E07` |
| `accents.orange.onAccent` | `#FFFFFF` | `accents.orange.onAccent` | `#FFFFFF` |
| `accents.green.primary` | `#247D52` | `accents.green.primary` | `#247D52` |
| `accents.green.text` | `#247D52` | `accents.green.text` | `#247D52` |
| `accents.green.pressed` | `#1B5E3E` | `accents.green.pressed` | `#1B5E3E` |
| `accents.green.soft` | `#D9F3E5` | `accents.green.soft` | `#D9F3E5` |
| `accents.green.onSoft` | `#1B5E3E` | `accents.green.onSoft` | `#1B5E3E` |
| `accents.green.onAccent` | `#FFFFFF` | `accents.green.onAccent` | `#FFFFFF` |
| `accents.blue.primary` | `#1A6CD5` | `accents.blue.primary` | `#1A6CD5` |
| `accents.blue.text` | `#1A6CD5` | `accents.blue.text` | `#1A6CD5` |
| `accents.blue.pressed` | `#2565BF` | `accents.blue.pressed` | `#2565BF` |
| `accents.blue.soft` | `#DCEAFF` | `accents.blue.soft` | `#DCEAFF` |
| `accents.blue.onSoft` | `#2565BF` | `accents.blue.onSoft` | `#2565BF` |
| `accents.blue.onAccent` | `#FFFFFF` | `accents.blue.onAccent` | `#FFFFFF` |
| `accents.purple.primary` | `#7250F4` | `accents.purple.primary` | `#7250F4` |
| `accents.purple.text` | `#7250F4` | `accents.purple.text` | `#7250F4` |
| `accents.purple.pressed` | `#6247CC` | `accents.purple.pressed` | `#6247CC` |
| `accents.purple.soft` | `#E6E0FF` | `accents.purple.soft` | `#E6E0FF` |
| `accents.purple.onSoft` | `#6247CC` | `accents.purple.onSoft` | `#6247CC` |
| `accents.purple.onAccent` | `#FFFFFF` | `accents.purple.onAccent` | `#FFFFFF` |
| `darkSurface.canvas` | `#181715` | `darkSurface.canvas` | `#181715` |
| `darkSurface.card` | `#222222` | `darkSurface.card` | `#222222` |
| `darkSurface.subtle` | `#2A2A2A` | `darkSurface.subtle` | `#2A2A2A` |
| `darkBorder.hairline` | `#333333` | `darkBorder.hairline` | `#333333` |
| `darkText.primary` | `#E6E6E6` | `darkText.primary` | `#E6E6E6` |
| `darkText.secondary` | `#CCCCCC` | `darkText.secondary` | `#CCCCCC` |
| `darkText.tertiary` | `#999999` | `darkText.tertiary` | `#999999` |
| `darkText.inverse` | `#FFFFFF` | `darkText.inverse` | `#FFFFFF` |
| `darkStatus.success` | `#4FAF86` | `darkStatus.success` | `#4FAF86` |
| `darkStatus.successSoft` | `#16402F` | `darkStatus.successSoft` | `#16402F` |
| `darkStatus.successText` | `#A7E8CD` | `darkStatus.successText` | `#A7E8CD` |
| `darkStatus.warning` | `#E59700` | `darkStatus.warning` | `#E59700` |
| `darkStatus.warningSoft` | `#3D2E0B` | `darkStatus.warningSoft` | `#3D2E0B` |
| `darkStatus.warningText` | `#FFD074` | `darkStatus.warningText` | `#FFD074` |
| `darkStatus.danger` | `#FF6B6B` | `darkStatus.danger` | `#FF6B6B` |
| `darkStatus.dangerSoft` | `#4A1A20` | `darkStatus.dangerSoft` | `#4A1A20` |
| `darkStatus.dangerText` | `#FF8A94` | `darkStatus.dangerText` | `#FF8A94` |
| `darkStatus.info` | `#7B8CFF` | `darkStatus.info` | `#7161E2` |
| `darkStatus.infoSoft` | `#2F2A55` | `darkStatus.infoSoft` | `#2F2A55` |
| `darkStatus.infoText` | `#A99DF5` | `darkStatus.infoText` | `#C7BFFF` |
| `night.surface` | `#222222` | `night.surface` | `#222222` |
| `night.raised` | `#2A2A2A` | `night.raised` | `#2A2A2A` |
| `night.line` | `#333333` | `night.line` | `#333333` |
| `onDark.strong` | `rgba(255,255,255,0.9)` | `onDark.strong` | `rgba(255,255,255,0.9)` |
| `onDark.medium` | `rgba(255,255,255,0.8)` | `onDark.medium` | `rgba(255,255,255,0.8)` |
| `onDark.soft` | `rgba(255,255,255,0.6)` | `onDark.soft` | `rgba(255,255,255,0.6)` |
| `onDark.wash` | `rgba(255,255,255,0.3)` | `onDark.wash` | `rgba(255,255,255,0.3)` |
| `overlay.scrimLight` | `rgba(0,0,0,0.2)` | `overlay.scrimLight` | `rgba(0,0,0,0.2)` |
| `overlay.scrimMedium` | `rgba(0,0,0,0.25)` | `overlay.scrimMedium` | `rgba(0,0,0,0.25)` |
| `overlay.scrim` | `rgba(0,0,0,0.35)` | `overlay.scrim` | `rgba(0,0,0,0.35)` |
| `overlay.scrimStrong` | `rgba(0,0,0,0.4)` | `overlay.scrimStrong` | `rgba(0,0,0,0.4)` |
| `overlay.scrimText` | `rgba(0,0,0,0.6)` | `overlay.scrimText` | `rgba(0,0,0,0.6)` |
| `overlay.backdrop` | `rgba(33,31,28,0.55)` | `overlay.backdrop` | `rgba(33,31,28,0.55)` |
| `shadows.stitch.shadowColor` | `#211F1C` | `shadows.subtle.shadowColor` | `#211F1C` |
| `shadows.warm` | `#362D26` | `shadows.warm` | `#362D26` |
| `shadows.black` | `#000` | `shadows.black` | `#000` |
| `shadows.card.shadowColor` | `#211F1C` | `shadows.card.shadowColor` | `#211F1C` |
| `shadows.toast.shadowColor` | `#211F1C` | `shadows.toast.shadowColor` | `#211F1C` |
| `mapColors.canvas` | `#DCE9DC` | `mapColors.canvas` | `#DCE9DC` |
| `mapColors.road` | `rgba(255,255,255,0.55)` | `mapColors.road` | `rgba(255,255,255,0.55)` |
| `mapColors.roadFill` | `#FFFFFF` | `mapColors.roadFill` | `#FFFFFF` |
| `mapColors.water` | `#B8D9E8` | `mapColors.water` | `#B8D9E8` |
| `mapColors.park` | `#C5DDC5` | `mapColors.park` | `#C5DDC5` |
| `mapColors.label` | `#746E68` | `mapColors.label` | `#5A413B` |
| `mapColors.labelStroke` | `#F6F3EE` | `mapColors.labelStroke` | `#FFF8F3` |
| `darkMapColors.canvas` | `#1F2A22` | `darkMapColors.canvas` | `#1F2A22` |
| `darkMapColors.road` | `rgba(255,255,255,0.12)` | `darkMapColors.road` | `rgba(255,255,255,0.12)` |
| `darkMapColors.roadFill` | `#333333` | `darkMapColors.roadFill` | `#333333` |
| `darkMapColors.water` | `#15232E` | `darkMapColors.water` | `#15232E` |
| `darkMapColors.park` | `#24392B` | `darkMapColors.park` | `#24392B` |
| `darkMapColors.label` | `#CCCCCC` | `darkMapColors.label` | `#CCCCCC` |
| `darkMapColors.labelStroke` | `#222222` | `darkMapColors.labelStroke` | `#222222` |
| `glassFx.sheet` | `#FCFBF8` | `glassFx.sheet` | `#FFF8F3` |
| `glassFx.bar` | `rgba(252,251,248,0.97)` | `glassFx.bar` | `rgba(252,251,248,0.97)` |
| `glassFx.solid` | `rgba(255,255,255,0.95)` | `glassFx.solid` | `rgba(255,255,255,0.95)` |
| `glassFx.pill` | `rgba(255,255,255,0.92)` | `glassFx.pill` | `rgba(255,255,255,0.92)` |
| `glassFx.cardWash` | `rgba(255,255,255,0.85)` | `glassFx.cardWash` | `rgba(255,255,255,0.85)` |
| `glassFx.chip` | `rgba(255,255,255,0.78)` | `glassFx.chip` | `rgba(255,255,255,0.78)` |
| `glassFx.border` | `rgba(255,255,255,0.72)` | `glassFx.border` | `rgba(255,255,255,0.72)` |
| `glassFx.borderBright` | `rgba(255,255,255,0.9)` | `glassFx.borderBright` | `rgba(255,255,255,0.9)` |
| `glassFx.borderLight` | `rgba(255,255,255,0.8)` | `glassFx.borderLight` | `rgba(255,255,255,0.8)` |
| `glassFx.dockTint` | `rgba(255,255,255,0.55)` | `glassFx.dockTint` | `rgba(255,255,255,0.55)` |
| `glassFx.nativeTint` | `rgba(255,255,255,0.4)` | `glassFx.nativeTint` | `rgba(255,255,255,0.4)` |
| `glassFx.nativeTintStrong` | `rgba(255,255,255,0.62)` | `glassFx.nativeTintStrong` | `rgba(255,255,255,0.62)` |
| `glassFx.badge` | `rgba(255,255,255,0.3)` | `glassFx.badge` | `rgba(255,255,255,0.3)` |
| `glassFx.btnBorder` | `rgba(255,255,255,0.26)` | `glassFx.btnBorder` | `rgba(255,255,255,0.26)` |
| `glassFx.neutralChip` | `rgba(236,232,225,0.85)` | `glassFx.neutralChip` | `rgba(236,232,225,0.85)` |
| `glass.subtle.background` | `rgba(255,255,255,0.38)` | `glass.subtle.background` | `rgba(255,255,255,0.38)` |
| `glass.subtle.border` | `rgba(255,255,255,0.58)` | `glass.subtle.border` | `rgba(255,255,255,0.58)` |
| `glass.regular.background` | `rgba(255,255,255,0.56)` | `glass.regular.background` | `rgba(255,255,255,0.56)` |
| `glass.regular.border` | `rgba(255,255,255,0.72)` | `glass.regular.border` | `rgba(255,255,255,0.72)` |
| `glass.strong.background` | `rgba(255,255,255,0.76)` | `glass.strong.background` | `rgba(255,255,255,0.76)` |
| `glass.strong.border` | `rgba(255,255,255,0.80)` | `glass.strong.border` | `rgba(255,255,255,0.80)` |
| `glass.tint.lavender` | `rgba(229,224,255,0.58)` | `glass.tint.lavender` | `rgba(229,224,255,0.58)` |
| `glass.tint.mint` | `rgba(217,243,231,0.64)` | `glass.tint.mint` | `rgba(217,243,231,0.64)` |
| `glass.opaqueFallback` | `rgba(252,251,248,0.94)` | `glass.opaqueFallback` | `rgba(252,251,248,0.94)` |
| `glass.bar.wash` | `rgba(255,255,255,0.78)` | `glass.bar.wash` | `rgba(255,255,255,0.78)` |
| `glass.bar.solid` | `#FFFFFF` | `glass.bar.solid` | `#FFFFFF` |
| `glass.bar.hairline` | `#ECE8E1` | `glass.bar.hairline` | `#E3BEB7` |
| `glass.bar.nativeTint` | `rgba(255,255,255,0.4)` | `glass.bar.nativeTint` | `rgba(255,255,255,0.4)` |
| `darkGlass.bar.wash` | `rgba(24,23,21,0.8)` | `darkGlass.bar.wash` | `rgba(24,23,21,0.8)` |
| `darkGlass.bar.solid` | `#181715` | `darkGlass.bar.solid` | `#181715` |
| `darkGlass.bar.hairline` | `rgba(51,51,51,0.7)` | `darkGlass.bar.hairline` | `rgba(51,51,51,0.7)` |
| `darkGlass.bar.nativeTint` | `rgba(0,0,0,0.4)` | `darkGlass.bar.nativeTint` | `rgba(0,0,0,0.4)` |
| `redesignLight.savedCanvas` | `#FAF7F2` | `surface.inset` | `#FAF7F2` |
| `redesignLight.savedLine` | `#E5E5E5` | Deleted | — |
| `redesignLight.savedMuted` | `#737373` | Deleted | — |
| `redesignLight.savedChip` | `#F5F5F5` | Deleted | — |
| `redesignLight.savedCount` | `#E5E5E5` | `surface.disabled` | `#E5E5E5` |
| `redesignLight.savedAccentSoft` | `#FDF4F2` | Deleted | — |
| `redesignLight.savedAccent` | `#B82F15` | `accents.orange.textMuted` | `#B82F15` |
| `redesignLight.savedGoogleFill` | `#FFFBEB` | Deleted | — |
| `redesignLight.savedGoogleText` | `#92400E` | Deleted | — |
| `redesignLight.savedGoogleLine` | `#FDE68A` | Deleted | — |
| `redesignLight.savedPhotoScrim` | `rgba(0,0,0,0.6)` | Deleted | — |
| `redesignLight.savedOpenDot` | `#34D399` | Deleted | — |
| `redesignLight.importInputCanvas` | `#FAF7F2` | `surface.inset` | `#FAF7F2` |
| `redesignLight.importInputLine` | `#E5E5E5` | `border.neutral` | `#E5E5E5` |
| `redesignLight.importInputDim` | `#F3EEE7` | `surface.muted` | `#F3EEE7` |
| `redesignLight.importInputPrimary` | `#C2351D` | `accents.orange.primaryMuted` | `#C2351D` |
| `redesignLight.importSyncedFill` | `#9EF5C0` | `status.successContainer` | `#9EF5C0` |
| `redesignLight.importSyncedText` | `#002111` | `status.onSuccessContainer` | `#002111` |
| `redesignLight.importPhotoBadgeText` | `#C0FFD6` | Deleted | — |
| `redesignLight.verifiedFill` | `#247D52` | `status.successStrongFill` | `#247D52` |
| `redesignLight.primaryFill` | `#CA381F` | `accents.orange.primary` | `#CA381F` |
| `redesignLight.primaryText` | `#A71E07` | `accents.orange.text` | `#A71E07` |
| `redesignLight.heroStart` | `#FFE8E2` | `accents.orange.gradientStart` | `#FFE8E2` |
| `redesignLight.heroMiddle` | `#FFF3EE` | `accents.orange.gradientMiddle` | `#FFF3EE` |
| `redesignLight.heroEnd` | `#EAE6FE` | `status.infoGradient` | `#EAE6FE` |
| `redesignLight.canvas` | `#FFF8F3` | `surface.canvas` | `#FFF8F3` |
| `redesignLight.card` | `#FFFFFF` | `surface.card` | `#FFFFFF` |
| `redesignLight.low` | `#F9F2ED` | `surface.low` | `#F9F2ED` |
| `redesignLight.container` | `#F3EDE8` | `surface.container` | `#F3EDE8` |
| `redesignLight.high` | `#EDE7E2` | `surface.high` | `#EDE7E2` |
| `redesignLight.highest` | `#E7E1DC` | `surface.highest` | `#E7E1DC` |
| `redesignLight.dim` | `#DFD9D4` | `surface.dim` | `#DFD9D4` |
| `redesignLight.ink` | `#1D1B18` | `text.primary` | `#1D1B18` |
| `redesignLight.secondary` | `#5A413B` | `text.secondary` | `#5A413B` |
| `redesignLight.outline` | `#8E706A` | `border.outline` | `#8E706A` |
| `redesignLight.line` | `#E3BEB7` | `border.hairline` | `#E3BEB7` |
| `redesignLight.checklistUnmet` | `#8A6C66` | `text.supporting` | `#8A6C66` |
| `redesignLight.recommendationFill` | `#237C51` | `status.successFill` | `#237C51` |
| `redesignLight.mutedTitle` | `#211F1C` | `text.neutralPrimary` | `#211F1C` |
| `redesignLight.mutedBody` | `#746E68` | `text.neutralSecondary` | `#746E68` |
| `redesignLight.primary` | `#A71E07` | `accents.orange.primaryDeep` | `#A71E07` |
| `redesignLight.primarySoft` | `#FFDAD3` | `accents.orange.container` | `#FFDAD3` |
| `redesignLight.moodSelected` | `#FFE3DA` | `accents.orange.selected` | `#FFE3DA` |
| `redesignLight.violet` | `#7161E2` | `status.info` | `#7161E2` |
| `redesignLight.violetText` | `#5747C8` | `status.infoText` | `#5747C8` |
| `redesignLight.violetSoft` | `#E4DFFF` | `status.infoSoft` | `#E4DFFF` |
| `redesignLight.violetInk` | `#170065` | `status.infoInk` | `#170065` |
| `redesignLight.green` | `#237C51` | `status.success` | `#237C51` |
| `redesignLight.greenText` | `#00623C` | `status.successText` | `#00623C` |
| `redesignLight.greenSoft` | `#ECFFF3` | `status.successSoft` | `#ECFFF3` |
| `redesignLight.white` | `#FFFFFF` | `text.inverse` | `#FFFFFF` |
| `redesignLight.bubble` | `rgba(255,255,255,0.95)` | `glass.opaque` | `rgba(255,255,255,0.95)` |
| `redesignLight.panel` | `rgba(255,255,255,0.90)` | `glass.translucent` | `rgba(255,255,255,0.90)` |
| `redesignLight.header` | `rgba(255,248,243,0.85)` | `glass.header` | `rgba(255,248,243,0.85)` |
| `redesignLight.scrimStart` | `rgba(50,48,45,0.80)` | `overlay.gradientStrong` | `rgba(50,48,45,0.80)` |
| `redesignLight.scrimMiddle` | `rgba(50,48,45,0.20)` | `overlay.gradientLight` | `rgba(50,48,45,0.20)` |
| `redesignLight.clear` | `rgba(50,48,45,0)` | `overlay.clear` | `rgba(50,48,45,0)` |
| `redesignLight.glowWarm` | `#FFDAD3` | `accents.orange.glow` | `#FFDAD3` |
| `redesignLight.glowCool` | `#7161E2` | `status.info` | `#7161E2` |
| `redesignLight.glowGreen` | `#237C51` | `status.success` | `#237C51` |
| `redesignDark.savedCanvas` | `#181715` | `darkSurface.inset` | `#181715` |
| `redesignDark.savedLine` | `#333333` | Deleted | — |
| `redesignDark.savedMuted` | `#CCCCCC` | Deleted | — |
| `redesignDark.savedChip` | `#2A2A2A` | Deleted | — |
| `redesignDark.savedCount` | `#333333` | `darkSurface.disabled` | `#333333` |
| `redesignDark.savedAccentSoft` | `#2A2A2A` | Deleted | — |
| `redesignDark.savedAccent` | `#FF746C` | `darkAccents.orange.textMuted` | `#FF746C` |
| `redesignDark.savedGoogleFill` | `#392C18` | Deleted | — |
| `redesignDark.savedGoogleText` | `#FDE68A` | Deleted | — |
| `redesignDark.savedGoogleLine` | `#69502B` | Deleted | — |
| `redesignDark.savedPhotoScrim` | `rgba(0,0,0,0.6)` | Deleted | — |
| `redesignDark.savedOpenDot` | `#34D399` | Deleted | — |
| `redesignDark.importInputCanvas` | `#181715` | `darkSurface.inset` | `#181715` |
| `redesignDark.importInputLine` | `#333333` | `darkBorder.neutral` | `#333333` |
| `redesignDark.importInputDim` | `#2A2A2A` | `darkSurface.muted` | `#2A2A2A` |
| `redesignDark.importInputPrimary` | `#CA381F` | `darkAccents.orange.primaryMuted` | `#CA381F` |
| `redesignDark.importSyncedFill` | `#16402F` | `darkStatus.successContainer` | `#16402F` |
| `redesignDark.importSyncedText` | `#A7E8CD` | `darkStatus.onSuccessContainer` | `#A7E8CD` |
| `redesignDark.importPhotoBadgeText` | `#C0FFD6` | Deleted | — |
| `redesignDark.verifiedFill` | `#247D52` | `darkStatus.successStrongFill` | `#247D52` |
| `redesignDark.primaryFill` | `#CA381F` | `darkAccents.orange.primary` | `#CA381F` |
| `redesignDark.primaryText` | `#FF746C` | `darkAccents.orange.text` | `#FF746C` |
| `redesignDark.heroStart` | `#2A2A2A` | `darkAccents.orange.gradientStart` | `#2A2A2A` |
| `redesignDark.heroMiddle` | `#222222` | `darkAccents.orange.gradientMiddle` | `#222222` |
| `redesignDark.heroEnd` | `#2F2A55` | `darkStatus.infoGradient` | `#2F2A55` |
| `redesignDark.canvas` | `#181715` | `darkSurface.canvas` | `#181715` |
| `redesignDark.card` | `#222222` | `darkSurface.card` | `#222222` |
| `redesignDark.low` | `#2A2A2A` | `darkSurface.low` | `#2A2A2A` |
| `redesignDark.container` | `#2A2A2A` | `darkSurface.container` | `#2A2A2A` |
| `redesignDark.high` | `#333333` | `darkSurface.high` | `#333333` |
| `redesignDark.highest` | `#333333` | `darkSurface.highest` | `#333333` |
| `redesignDark.dim` | `#333333` | `darkSurface.dim` | `#333333` |
| `redesignDark.ink` | `#E6E6E6` | `darkText.primary` | `#E6E6E6` |
| `redesignDark.secondary` | `#CCCCCC` | `darkText.secondary` | `#CCCCCC` |
| `redesignDark.outline` | `#999999` | `darkBorder.outline` | `#999999` |
| `redesignDark.line` | `#333333` | `darkBorder.hairline` | `#333333` |
| `redesignDark.checklistUnmet` | `#999999` | `darkText.supporting` | `#999999` |
| `redesignDark.recommendationFill` | `#3B8365` | `darkStatus.successFill` | `#3B8365` |
| `redesignDark.mutedTitle` | `#E6E6E6` | `darkText.neutralPrimary` | `#E6E6E6` |
| `redesignDark.mutedBody` | `#CCCCCC` | `darkText.neutralSecondary` | `#CCCCCC` |
| `redesignDark.primary` | `#A72E19` | `darkAccents.orange.primaryDeep` | `#A72E19` |
| `redesignDark.primarySoft` | `#2A2A2A` | `darkAccents.orange.container` | `#2A2A2A` |
| `redesignDark.moodSelected` | `#472C25` | `darkAccents.orange.selected` | `#472C25` |
| `redesignDark.violet` | `#7161E2` | `darkStatus.info` | `#7161E2` |
| `redesignDark.violetText` | `#C7BFFF` | `darkStatus.infoText` | `#C7BFFF` |
| `redesignDark.violetSoft` | `#2F2A55` | `darkStatus.infoSoft` | `#2F2A55` |
| `redesignDark.violetInk` | `#C7BFFF` | `darkStatus.infoInk` | `#C7BFFF` |
| `redesignDark.green` | `#4FAF86` | `darkStatus.success` | `#4FAF86` |
| `redesignDark.greenText` | `#A7E8CD` | `darkStatus.successText` | `#A7E8CD` |
| `redesignDark.greenSoft` | `#16402F` | `darkStatus.successSoft` | `#16402F` |
| `redesignDark.white` | `#FFFFFF` | `darkText.inverse` | `#FFFFFF` |
| `redesignDark.bubble` | `rgba(34,34,34,0.95)` | `darkGlass.opaque` | `rgba(34,34,34,0.95)` |
| `redesignDark.panel` | `rgba(34,34,34,0.90)` | `darkGlass.translucent` | `rgba(34,34,34,0.90)` |
| `redesignDark.header` | `rgba(24,23,21,0.85)` | `darkGlass.header` | `rgba(24,23,21,0.85)` |
| `redesignDark.scrimStart` | `rgba(50,48,45,0.80)` | `overlay.gradientStrong` | `rgba(50,48,45,0.80)` |
| `redesignDark.scrimMiddle` | `rgba(50,48,45,0.20)` | `overlay.gradientLight` | `rgba(50,48,45,0.20)` |
| `redesignDark.clear` | `rgba(50,48,45,0)` | `overlay.clear` | `rgba(50,48,45,0)` |
| `redesignDark.glowWarm` | `#FF746C` | `darkAccents.orange.glow` | `#FF746C` |
| `redesignDark.glowCool` | `#7161E2` | `darkStatus.info` | `#7161E2` |
| `redesignDark.glowGreen` | `#4FAF86` | `darkStatus.success` | `#4FAF86` |
| `darkAccents.orange.primary` | `#CA381F` | `darkAccents.orange.primary` | `#CA381F` |
| `darkAccents.orange.text` | `#FF746C` | `darkAccents.orange.text` | `#FF746C` |
| `darkAccents.orange.pressed` | `#A72E19` | `darkAccents.orange.pressed` | `#A72E19` |
| `darkAccents.orange.soft` | `#2A2A2A` | `darkAccents.orange.soft` | `#2A2A2A` |
| `darkAccents.orange.onSoft` | `#FF746C` | `darkAccents.orange.onSoft` | `#FF746C` |
| `darkAccents.orange.onAccent` | `#FFFFFF` | `darkAccents.orange.onAccent` | `#FFFFFF` |
| `darkAccents.green.primary` | `#247D52` | `darkAccents.green.primary` | `#247D52` |
| `darkAccents.green.text` | `#79D9AD` | `darkAccents.green.text` | `#79D9AD` |
| `darkAccents.green.pressed` | `#1A5E3D` | `darkAccents.green.pressed` | `#1A5E3D` |
| `darkAccents.green.soft` | `#16402F` | `darkAccents.green.soft` | `#16402F` |
| `darkAccents.green.onSoft` | `#79D9AD` | `darkAccents.green.onSoft` | `#79D9AD` |
| `darkAccents.green.onAccent` | `#FFFFFF` | `darkAccents.green.onAccent` | `#FFFFFF` |
| `darkAccents.blue.primary` | `#1E68D7` | `darkAccents.blue.primary` | `#1E68D7` |
| `darkAccents.blue.text` | `#94BEF7` | `darkAccents.blue.text` | `#94BEF7` |
| `darkAccents.blue.pressed` | `#164EB0` | `darkAccents.blue.pressed` | `#164EB0` |
| `darkAccents.blue.soft` | `#192B45` | `darkAccents.blue.soft` | `#192B45` |
| `darkAccents.blue.onSoft` | `#94BEF7` | `darkAccents.blue.onSoft` | `#94BEF7` |
| `darkAccents.blue.onAccent` | `#FFFFFF` | `darkAccents.blue.onAccent` | `#FFFFFF` |
| `darkAccents.purple.primary` | `#7161E2` | `darkAccents.purple.primary` | `#7161E2` |
| `darkAccents.purple.text` | `#C7BFFF` | `darkAccents.purple.text` | `#C7BFFF` |
| `darkAccents.purple.pressed` | `#5747C8` | `darkAccents.purple.pressed` | `#5747C8` |
| `darkAccents.purple.soft` | `#2F2A55` | `darkAccents.purple.soft` | `#2F2A55` |
| `darkAccents.purple.onSoft` | `#C7BFFF` | `darkAccents.purple.onSoft` | `#C7BFFF` |
| `darkAccents.purple.onAccent` | `#FFFFFF` | `darkAccents.purple.onAccent` | `#FFFFFF` |
| `photoEditor.canvas` | `#121212` | `workspace.canvas` | `#121212` |
| `photoEditor.dock` | `#181818` | `workspace.surface` | `#181818` |
| `photoEditor.black` | `#000000` | `workspace.void` | `#000000` |
| `photoEditor.line` | `#333333` | `workspace.border` | `#333333` |
| `photoEditor.raised` | `#262626` | `workspace.raised` | `#262626` |
| `photoEditor.pressed` | `#444444` | `workspace.emphasis` | `#444444` |
| `photoEditor.pill` | `#000000BF` | `workspace.scrim` | `#000000BF` |
| `photoEditor.white` | `#FFFFFF` | `workspace.foreground` | `#FFFFFF` |

## Native launch colours

`app.config.ts` also reads the pure token file through the explicit `.ts` extension supported by Node 22 (local and CI). No alias, runtime UI module or dependency is loaded. Native app background changes from `#F6F3EE` to Stitch canvas `#FFF8F3`; adaptive-icon background changes from the old fixed coral `#D84F4A` to default Stitch orange `#CA381F` (accent-only). Splash Light/Dark stays exactly `#FFF8F3`/`#181715`. The production literal scan covers this config too. Expo resolved-config smoke check passed with those exact values (`/tmp/556r2-expo-config.log`, `/tmp/556r2-expo-config.json`; the full JSON may contain local build configuration, so only the four colour fields were printed). No native project was generated or rebuilt.

## Files changed — historical #559 inventory

106 files (including this document, fixtures and tests). Full list:

- `app.config.ts`
- `docs/verification/issue-556-color-tokens.md`
- `src/app/(tabs)/_layout.tsx`
- `src/features/__tests__/design-drift-home-search.spec.tsx`
- `src/features/__tests__/guest-replace-confirm.spec.tsx`
- `src/features/__tests__/home-location-scope.spec.tsx`
- `src/features/__tests__/place-import-owner.spec.tsx`
- `src/features/__tests__/redesign-g01-dark.spec.tsx`
- `src/features/__tests__/saved-link.spec.tsx`
- `src/features/account/account.style.tsx`
- `src/features/account/account.view.tsx`
- `src/features/account/avatar-editor.style.tsx`
- `src/features/account/date-of-birth.style.tsx`
- `src/features/account/profile-defaults.style.tsx`
- `src/features/account/profile-defaults.view.tsx`
- `src/features/account/theme-accent.style.tsx`
- `src/features/account/theme-accent.view.tsx`
- `src/features/auth/sign-in.view.tsx`
- `src/features/home/home.style.tsx`
- `src/features/home/home.view.tsx`
- `src/features/home/quick-join.view.tsx`
- `src/features/notifications/notification-switch.style.tsx`
- `src/features/notifications/notification-switch.view.tsx`
- `src/features/onboarding/onboarding-visual.style.tsx`
- `src/features/onboarding/onboarding-visual.view.tsx`
- `src/features/onboarding/onboarding.view.tsx`
- `src/features/onboarding/splash-map.view.tsx`
- `src/features/onboarding/splash.style.tsx`
- `src/features/onboarding/splash.view.tsx`
- `src/features/place-import/contribution-choices.view.tsx`
- `src/features/place-import/contribution-wizard.style.tsx`
- `src/features/place-import/contribution-wizard.view.tsx`
- `src/features/place-import/existing-place-result.view.tsx`
- `src/features/place-import/import-guide.view.tsx`
- `src/features/place-import/import-photos.view.tsx`
- `src/features/place-import/import.style.tsx`
- `src/features/place-import/import.view.tsx`
- `src/features/search/search-empty.view.tsx`
- `src/features/search/search-map-panel.style.tsx`
- `src/features/search/search.style.tsx`
- `src/features/search/search.view.tsx`
- `src/features/settings/location-permission.style.tsx`
- `src/features/settings/location-permission.view.tsx`
- `src/features/settings/permissions.style.tsx`
- `src/features/settings/permissions.view.tsx`
- `src/features/settings/tracking-consent.style.tsx`
- `src/features/tabs/profile-upcoming.view.tsx`
- `src/features/tabs/profile.style.tsx`
- `src/features/tabs/profile.view.tsx`
- `src/features/tabs/saved-city.style.tsx`
- `src/features/tabs/saved-city.view.tsx`
- `src/features/tabs/saved.style.tsx`
- `src/features/tabs/saved.view.tsx`
- `src/shared/administrative/administrative-picker.style.tsx`
- `src/shared/administrative/administrative-picker.view.tsx`
- `src/shared/location/current-area-sheet.style.tsx`
- `src/shared/ui/__tests__/accent-foreground.spec.tsx`
- `src/shared/ui/__tests__/accent-refs.test.ts`
- `src/shared/ui/__tests__/app-color-roles.spec.tsx`
- `src/shared/ui/__tests__/button.spec.tsx`
- `src/shared/ui/__tests__/color-roles.test.ts`
- `src/shared/ui/__tests__/colour-literals.test.ts`
- `src/shared/ui/__tests__/contrast.test.ts`
- `src/shared/ui/__tests__/fixtures/stitch-color-pins.json`
- `src/shared/ui/__tests__/icon.spec.tsx`
- `src/shared/ui/__tests__/mode-aware.test.ts`
- `src/shared/ui/__tests__/place-card.spec.tsx`
- `src/shared/ui/__tests__/rating-chips.spec.tsx`
- `src/shared/ui/__tests__/redesign-contrast-dark.spec.tsx`
- `src/shared/ui/__tests__/redesign-contrast.spec.tsx`
- `src/shared/ui/__tests__/redesign-contrast.test.ts`
- `src/shared/ui/__tests__/redesign-theme.test.ts`
- `src/shared/ui/__tests__/shared-primitives-dark.spec.tsx`
- `src/shared/ui/__tests__/sheet-surfaces.spec.tsx`
- `src/shared/ui/__tests__/text.spec.tsx`
- `src/shared/ui/__tests__/theme-dark.test.ts`
- `src/shared/ui/ambient-glow.view.tsx`
- `src/shared/ui/badge.style.tsx`
- `src/shared/ui/badge.view.tsx`
- `src/shared/ui/button.style.tsx`
- `src/shared/ui/button.view.tsx`
- `src/shared/ui/card.style.tsx`
- `src/shared/ui/chip.style.tsx`
- `src/shared/ui/chip.view.tsx`
- `src/shared/ui/frosted-material.style.tsx`
- `src/shared/ui/header-notification-button.style.tsx`
- `src/shared/ui/header-notification-button.view.tsx`
- `src/shared/ui/info-banner.style.tsx`
- `src/shared/ui/info-banner.view.tsx`
- `src/shared/ui/labelled-input.style.tsx`
- `src/shared/ui/labelled-input.view.tsx`
- `src/shared/ui/material-icon.tsx`
- `src/shared/ui/password-requirements.view.tsx`
- `src/shared/ui/place-card.style.tsx`
- `src/shared/ui/primitives.tsx`
- `src/shared/ui/rating-chips.style.tsx`
- `src/shared/ui/rating-chips.view.tsx`
- `src/shared/ui/search-field.style.tsx`
- `src/shared/ui/search-field.view.tsx`
- `src/shared/ui/segmented-control.style.tsx`
- `src/shared/ui/segmented-control.view.tsx`
- `src/shared/ui/sheet.style.tsx`
- `src/shared/ui/text.tsx`
- `src/shared/ui/theme.ts`
- `src/shared/ui/tokens.ts`
- `src/shared/ui/unavailable-action.view.tsx`

## #559 owner simulator follow-up — historical sheet header surfaces

Basis: clean `ce0c0cd`, `feature/GOGO-556-app-color-tokens`. UI-only, no commit/push.
`AppHeader`'s sheet variant was changed in this historical follow-up to use `surface.card` and no additional horizontal row inset. **Current rebase resolution:** retains the card-surface colour fix, but restores the target re-design’s 16-point row inset under the owner’s 2026-11-10 exact-UI instruction. Screen headers retain `surface.canvas` and their inset.
No token values, accent roles, business behavior or sheet presentation changed.

Full source audit (Light + Dark role resolution; headers, list/body containers, search/input fields,
footers and shared child controls):

| Sheet / source | Result |
| --- | --- |
| `shared/location/current-area-sheet.view.tsx` | Fixed “Chọn khu vực” header through shared sheet variant. Covers search, create-location and profile-defaults callers. |
| `shared/administrative/administrative-picker.view.tsx` | Fixed Province/City **and Ward/Commune** list headers, both embedded and standalone. Body/list inherits card; SearchField already uses card. |
| `features/search/search.view.tsx` filters | No mismatch: header/body/footer inherit card; price inputs use low. Canvas empty-actions footer belongs to the screen outside the sheet. |
| `features/place-import/contribution-choices.view.tsx` choices | No mismatch: header/list inherit card; search/options use low. |
| `features/assistant/history.view.tsx` menu and rename | No mismatch: menu inherits card, rename input uses card, footer inherits. |
| `features/assistant/proposal-edit.view.tsx` | No mismatch: body/footer inherit card, inputs use card. |
| `features/active-date/checkin-sheet.view.tsx` | No mismatch: header/list/footer inherit card, note/rating/photo controls use subtle. |
| `features/create-date/date-time-sheet.view.tsx` | No mismatch: header/calendar/footer inherit card; slots use subtle, summary uses accent.soft. |
| `features/create-date/create-time.view.tsx` time slots | No mismatch: title/list inherit card; slots use subtle. |
| `features/home/quick-join.view.tsx` guest name | No mismatch: title/footer inherit card; name input uses container. |
| `features/date-plan/place-detail.view.tsx` weekly hours | No mismatch: header/table inherit card. |
| `features/date-plan/place-report.view.tsx` | No mismatch: header/body/footer inherit card; note input uses subtle. |
| `shared/ui/result-sheet.view.tsx` all confirmation/result callers | No mismatch: title/body/footer inherit card. |
| `features/account/avatar-source-sheet.view.tsx` | Intentional canvas panel (`appearance="avatar"`), card option group; no canvas band inside a card panel. |
| `features/account/birthday-sheet.view.tsx` | Intentional canvas panel, card wheel/close control and subtle summary; no mismatch. |
| `shared/media/media-permission-sheet.view.tsx` | Intentional canvas panel, inherited title/body/footer; no mismatch. |
| `shared/consent/tracking-sheet.view.tsx` system/app custom bottom sheets | Card panel; header/body/footer inherit it. No mismatch. |
| `shared/notifications/device-promotions-sheet.view.tsx` custom bottom sheet | Card panel; header/body/footer inherit it. No mismatch. |

Also checked native Modal owners: Dialog uses card consistently, assistant pageSheet uses canvas
consistently, search map is a fullscreen canvas modal, and coachmark is a backdrop/tooltip.
Shared SheetActions is transparent; option lists use card; search fields use card/high; other controls
retain their existing low/subtle/container/accent/status roles. No additional sheet-specific patch was needed.

Regression: `sheet-surfaces.spec.tsx` renders the real Sheet/AppHeader and the real area and standalone
administrative pickers in all four accents × Light/Dark. The 32 added cases failed before the source fix
on canvas-versus-card equality (`/tmp/556h-regression-before.log`); all 84 focused tests passed after
(`/tmp/556h-regression-after.log`). Assertions also cover sheet content edges and preservation of screen headers.
These are rendered component/source checks; no simulator acceptance is claimed.

Requested gates:

- `pnpm typecheck`: exit 0 (`/tmp/556h-typecheck.log`).
- `pnpm lint`: exit 0 (`/tmp/556h-lint.log`).
- `pnpm test:ui --runInBand`: exit 0, 209 suites / 2863 tests passed (`/tmp/556h-test-ui.log`).
- `pnpm test`: exit 1, 140 files passed / 1 failed / 1 skipped; 1672 tests passed,
  39 skipped, 3 expected AA failures, exactly the 3 owner-declared distribute-wrapper lock failures
  (`/tmp/556h-test.log`): “refuses while the owner is alive”, “refuses recovery while a recorded build
  process group is still alive”, “keeps the lock and run files when a recorded build group is still alive
  after the child exits”. At the time of that historical run, the 3 named `it.fails` AA cases remained (white/status.danger, outline body captions on canvas/card); all three are now resolved per owner 2026-11-10.
- `git diff --check`: exit 0. Head remains `ce0c0cd`; no commit/push.
