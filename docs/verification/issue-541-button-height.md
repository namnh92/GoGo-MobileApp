> Cập nhật round 6h (2026-11-12): màn Quản lý phòng đã bỏ; các ghi nhận
> manage bên dưới là bằng chứng lịch sử. Chức năng hiện tại nằm ở sảnh phòng;
> `/room/[roomId]/manage` chỉ redirect về sảnh. Xem
> [quyết định hiện hành](../redesign/issue-595-unified-room-edit.md#round-6h--quyết-định-owner-2026-11-12-10-thay-màn-quản-lý-phòng).

# GoGo-MobileApp #541 local handoff

Regular buttons: 48pt minimum; small: 40pt minimum. Labels: 15/13pt, icons: 20/18pt; horizontal padding: 16/12pt; vertical padding: 12/8pt. All shared kinds and visual variants use these tokens. Wrapped labels can grow. hitSlop and minimum width keep touch targets at least 44pt. The floating + FAB is unchanged.

## Changed files and lines

- [src/features/__tests__/contribution-wizard.spec.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/__tests__/contribution-wizard.spec.tsx:597) — lines 597
- [src/features/__tests__/design-drift-home-search.spec.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/__tests__/design-drift-home-search.spec.tsx:169) — lines 169, 172
- [src/features/__tests__/onboarding-layout.spec.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/__tests__/onboarding-layout.spec.tsx:4) — lines 4, 92
- [src/features/__tests__/saved-link.spec.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/__tests__/saved-link.spec.tsx:3) — lines 3, 182, 195
- [src/features/date-plan/place-detail.style.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/date-plan/place-detail.style.tsx:178) — lines 178
- [src/features/date-plan/place-detail.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/date-plan/place-detail.view.tsx:591) — lines 591
- [src/features/home/home.style.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/home/home.style.tsx:22) — lines 22
- [src/features/onboarding/onboarding.style.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/onboarding/onboarding.style.tsx:14) — lines 14
- [src/features/place-import/contribution-wizard.style.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/place-import/contribution-wizard.style.tsx:153) — lines 153, 162, 173
- [src/features/place-import/contribution-wizard.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/place-import/contribution-wizard.view.tsx:429) — lines 429
- [src/features/search/search.style.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/search/search.style.tsx:8) — lines 8
- [src/features/search/search.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/search/search.view.tsx:267) — lines 267
- [src/features/tabs/profile.style.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/tabs/profile.style.tsx:83) — lines 83, 102
- [src/features/tabs/saved-link.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/tabs/saved-link.view.tsx:67) — lines 67
- [src/features/tabs/saved.style.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/tabs/saved.style.tsx:8) — lines 8, 15
- [src/features/tabs/saved.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/tabs/saved.view.tsx:164) — lines 164
- [src/shared/ui/__tests__/button-sizing.spec.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/shared/ui/__tests__/button-sizing.spec.tsx:1) — lines 1
- [src/shared/ui/__tests__/button.spec.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/shared/ui/__tests__/button.spec.tsx:5) — lines 5, 23, 36, 56, 59, 64, 67, 105, 113, 121
- [src/shared/ui/__tests__/result-sheet.spec.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/shared/ui/__tests__/result-sheet.spec.tsx:4) — lines 4, 52
- [src/shared/ui/__tests__/type-scale.test.ts](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/shared/ui/__tests__/type-scale.test.ts:51) — lines 51, 61
- [src/shared/ui/button.style.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/shared/ui/button.style.tsx:3) — lines 3, 19, 23, 25, 27, 35, 41, 45, 51, 61, 64, 68, 79, 86
- [src/shared/ui/button.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/shared/ui/button.view.tsx:10) — lines 10, 27, 85, 105, 125, 130, 133, 141, 173, 195
- [src/shared/ui/result-sheet.style.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/shared/ui/result-sheet.style.tsx:6) — lines 6
- [src/shared/ui/tokens.ts](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/shared/ui/tokens.ts:449) — lines 449, 569

## Explicit override migrations

- Onboarding: back icon uses shared small size; skip/guest variants use shared small size.
- Home quick-join: removes local button minimum height and padding.
- Search: filter icon selects shared regular size.
- Saved: quick-save and city actions select shared small size.
- Profile: edit icon and logout remove local sizing.
- Place detail: create-room CTA removes local height.
- Contribution wizard: photo action, back, next, submit and result actions remove local sizing.
- Shared result sheet: actions remove the 56pt override; affects all success/error/confirmation sheets.

## Direct shared-button consumers (screens and subviews)

All files below inherit the shared change. Shared dialogs, result sheets, permission sheets and async retry states also propagate it to their host screens. This is a source impact inventory; simulator acceptance is still pending.

- [src/features/account/account.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/account/account.view.tsx:321)
- [src/features/account/avatar-source-sheet.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/account/avatar-source-sheet.view.tsx:30)
- [src/features/account/birthday-sheet.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/account/birthday-sheet.view.tsx:115)
- [src/features/account/date-of-birth.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/account/date-of-birth.view.tsx:89)
- [src/features/account/defaults-screen.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/account/defaults-screen.view.tsx:19)
- [src/features/account/profile-defaults.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/account/profile-defaults.view.tsx:118)
- [src/features/account/theme-accent.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/account/theme-accent.view.tsx:78)
- [src/features/active-date/active-date.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/active-date/active-date.view.tsx:315)
- [src/features/active-date/checkin-sheet.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/active-date/checkin-sheet.view.tsx:254)
- [src/features/active-date/date-finished.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/active-date/date-finished.view.tsx:201)
- [src/features/assistant/confirmation-card.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/assistant/confirmation-card.view.tsx:85)
- [src/features/assistant/history.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/assistant/history.view.tsx:338)
- [src/features/assistant/proposal-edit.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/assistant/proposal-edit.view.tsx:176)
- [src/features/assistant/result-card.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/assistant/result-card.view.tsx:83)
- [src/features/assistant/sign-in-prompt.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/assistant/sign-in-prompt.view.tsx:30)
- [src/features/assistant/state-notice.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/assistant/state-notice.view.tsx:72)
- [src/features/assistant/task-summary.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/assistant/task-summary.view.tsx:39)
- [src/features/auth/sign-in.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/auth/sign-in.view.tsx:238)
- [src/features/contributions/my-contributions.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/contributions/my-contributions.view.tsx:83)
- [src/features/create-date/create-budget.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/create-date/create-budget.view.tsx:111)
- [src/features/create-date/create-location.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/create-date/create-location.view.tsx:198)
- [src/features/create-date/create-mood.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/create-date/create-mood.view.tsx:225)
- [src/features/create-date/create-time.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/create-date/create-time.view.tsx:195)
- [src/features/create-date/create-type.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/create-date/create-type.view.tsx:134)
- [src/features/create-date/date-time-sheet.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/create-date/date-time-sheet.view.tsx:248)
- [src/features/create-date/draft-resume.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/create-date/draft-resume.view.tsx:49)
- [src/features/create-date/group-setup.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/create-date/group-setup.view.tsx:108)
- [src/features/create-date/save-draft.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/create-date/save-draft.view.tsx:30)
- [src/features/create-date/wizard-actions.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/create-date/wizard-actions.view.tsx:58)
- [src/features/date-plan/date-plan.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/date-plan/date-plan.view.tsx:235)
- [src/features/date-plan/place-detail.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/date-plan/place-detail.view.tsx:591)
- [src/features/date-plan/place-report.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/date-plan/place-report.view.tsx:47)
- [src/features/date-plan/place-reviews.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/date-plan/place-reviews.view.tsx:115)
- [src/features/date-plan/plan-change.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/date-plan/plan-change.view.tsx:106)
- [src/features/date-plan/plan-edit.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/date-plan/plan-edit.view.tsx:214)
- [src/features/deep-link/not-found.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/deep-link/not-found.view.tsx:36)
- [src/features/deep-link/share-link.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/deep-link/share-link.view.tsx:176)
- [src/features/gogo-room/gogo-room.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/gogo-room/gogo-room.view.tsx:375)
- [src/features/gogo-room/guest-join.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/gogo-room/guest-join.view.tsx:230)
- [src/features/gogo-room/guest-replace-notice.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/gogo-room/guest-replace-notice.view.tsx:26)
- [src/features/gogo-room/invite-expired.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/gogo-room/invite-expired.view.tsx:18)
- [src/features/gogo-room/join-by-code.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/gogo-room/join-by-code.view.tsx:157)
- [src/features/gogo-room/room-manage.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/gogo-room/room-manage.view.tsx:188)
- [src/features/gogo-room/room-schedule-editor.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/gogo-room/room-schedule-editor.view.tsx:120)
- [src/features/gogo-room/room-title-editor.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/gogo-room/room-title-editor.view.tsx:85)
- [src/features/home/home.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/home/home.view.tsx:232)
- [src/features/home/quick-join.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/home/quick-join.view.tsx:70)
- [src/features/matching/match-result.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/matching/match-result.view.tsx:199)
- [src/features/matching/preference.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/matching/preference.view.tsx:213)
- [src/features/matching/suggestion-run-notice.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/matching/suggestion-run-notice.view.tsx:93)
- [src/features/matching/swipe.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/matching/swipe.view.tsx:338)
- [src/features/notifications/notification-switch.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/notifications/notification-switch.view.tsx:113)
- [src/features/notifications/notifications.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/notifications/notifications.view.tsx:149)
- [src/features/onboarding/onboarding.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/onboarding/onboarding.view.tsx:138)
- [src/features/place-import/contribution-choices.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/place-import/contribution-choices.view.tsx:67)
- [src/features/place-import/contribution-wizard.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/place-import/contribution-wizard.view.tsx:272)
- [src/features/place-import/existing-place-result.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/place-import/existing-place-result.view.tsx:46)
- [src/features/place-import/import-photos.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/place-import/import-photos.view.tsx:64)
- [src/features/place-import/import.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/place-import/import.view.tsx:376)
- [src/features/review/my-reviews.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/review/my-reviews.view.tsx:135)
- [src/features/review/review.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/review/review.view.tsx:198)
- [src/features/search/search-map-panel.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/search/search-map-panel.view.tsx:52)
- [src/features/search/search.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/search/search.view.tsx:206)
- [src/features/settings/device-promotions.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/settings/device-promotions.view.tsx:104)
- [src/features/settings/location-permission.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/settings/location-permission.view.tsx:113)
- [src/features/settings/permissions.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/settings/permissions.view.tsx:58)
- [src/features/settings/tracking-consent.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/settings/tracking-consent.view.tsx:81)
- [src/features/tabs/plans.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/tabs/plans.view.tsx:130)
- [src/features/tabs/profile-upcoming.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/tabs/profile-upcoming.view.tsx:32)
- [src/features/tabs/profile.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/tabs/profile.view.tsx:124)
- [src/features/tabs/saved-link.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/tabs/saved-link.view.tsx:67)
- [src/features/tabs/saved.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/features/tabs/saved.view.tsx:91)
- [src/shared/administrative/administrative-picker.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/shared/administrative/administrative-picker.view.tsx:52)
- [src/shared/consent/tracking-sheet.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/shared/consent/tracking-sheet.view.tsx:76)
- [src/shared/location/current-area-sheet.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/shared/location/current-area-sheet.view.tsx:53)
- [src/shared/media/media-permission-sheet.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/shared/media/media-permission-sheet.view.tsx:33)
- [src/shared/notifications/device-promotions-sheet.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/shared/notifications/device-promotions-sheet.view.tsx:52)
- [src/shared/ui/async-state.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/shared/ui/async-state.view.tsx:61)
- [src/shared/ui/dialog.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/shared/ui/dialog.view.tsx:83)
- [src/shared/ui/result-sheet.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-541/src/shared/ui/result-sheet.view.tsx:43)

## Validation

- `pnpm typecheck`: exit 0 (final run).
- `pnpm lint`: exit 0 (final run).
- `pnpm test`: exit 1; 136 test files pass, 1 fails, 1 skips. 1649 tests pass, 3 fail, 39 skip. The failures are the three existing distribution-wrapper lock/liveness cases at `src/shared/config/__tests__/distribute-wrapper.test.ts:206`, `:225`, `:244`. This sandbox denies `ps` and `pgrep` process-list access; those commands supply the lock owner's start time and build process-group liveness. The wrapper and its tests are unchanged.
- Focused recheck: 3 suites / 65 tests pass (onboarding layout, saved quick-save, result sheet).
- Full UI suite final run: exit 0. Test Suites: 202 passed, 202 total; Tests:       2619 passed, 2619 total; Time:        93.403 s, estimated 121 s
- Shared sizing tests cover all four accents in Light and Dark, both sizes, every visual variant and text-button kind, loading/disabled states, icon dimensions and minimum touch targets.
- Simulator: blocked. `rtk xcrun simctl list devices booted` exits 1; CoreSimulatorService connection invalid / operation not permitted. No simulator visual acceptance claimed.
- `git diff --check`: exit 0.
- No API, auth, navigation or business logic changes. No commit or push.

Logs: [unit tests](/tmp/mobile-541-test.log), [final UI tests](/tmp/mobile-541-ui-final.log), [lint](/tmp/mobile-541-lint-final.log), [typecheck](/tmp/mobile-541-typecheck-final.log).
