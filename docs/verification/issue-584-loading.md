> Cập nhật round 6h (2026-11-12): màn Quản lý phòng đã bỏ; các ghi nhận
> manage bên dưới là bằng chứng lịch sử. Chức năng hiện tại nằm ở sảnh phòng;
> `/room/[roomId]/manage` chỉ redirect về sảnh. Xem
> [quyết định hiện hành](../redesign/issue-595-unified-room-edit.md#round-6h--quyết-định-owner-2026-11-12-10-thay-màn-quản-lý-phòng).

# GoGo-MobileApp #584 — loading indicator return

UI-only implementation on `feature/GOGO-584-loading`; base HEAD and local `origin/re-design` are `c0ac8fb6dec790e45c04cff46560804809c20c74`. No commit or push.

## Reference and shared implementation

- Stitch project `17315762413421369447`, screen `e5c97105afea4cc3a2755cd171af5b81` (`GoGo Loading Indicator · Chuẩn Kích Thước 48x48`), read through Stitch get_screen/download_file. Reference HTML: `/tmp/584-stitch.html`.
- Pin-loop path matches the source after whitespace normalization. All nine spectrum stops and all five crossover stops match. All five 48px SVG instances on the sheet use the same SVG recipe, including the Light/Dark/brand examples: the component keeps that transparent artwork on every ground.
- Default 48px; compact 24px in constrained controls. Reanimated bounce and traveling beam use shared duration tokens. Reduced motion, or an unanswered OS preference, renders the static mark; setting changes and unmount cancel both loops.
- `src/shared/ui/loading-indicator.view.tsx:26` — SVG, unique gradient IDs, animation and accessibility.
- `src/shared/ui/loading-indicator.style.tsx:4` — layout and token shadow; view/style split.
- `src/shared/ui/tokens.ts:509` — loop durations; `src/shared/ui/tokens.ts:534` — fixed brand artwork palette and sizes.
- `src/shared/ui/button.view.tsx:125` — all button families retain the label, disable repeat submission, and show the decorative GoGo mark.
- `src/shared/ui/async-state.view.tsx:23` — shared non-list/blocking loading states.
- `src/shared/ui/refresh-control.view.tsx:8` — native fallback with theme tint, Android progress surface, and GoGo header. RN iOS/Android RefreshControl does not accept SVG children; its native gesture/control stays in place.

## Direct replacements and added pagination feedback

| Site | File:line |
| --- | --- |
| Account save header | `src/features/account/account.view.tsx:310` |
| Avatar upload overlay | `src/features/account/account.view.tsx:359` |
| Avatar confirmation/upload | `src/features/account/avatar-editor.view.tsx:117` |
| Defaults blocking load | `src/features/account/profile-defaults.view.tsx:173` |
| Check-in photo upload overlay | `src/features/active-date/checkin-sheet.view.tsx:201` |
| Assistant image upload | `src/features/assistant/composer.view.tsx:88` |
| Older-message pagination | `src/features/assistant/conversation.view.tsx:150` |
| History pagination footer (added) | `src/features/assistant/history.view.tsx:200` |
| Current-location request | `src/features/create-date/create-location.view.tsx:145` |
| Share-link resolution | `src/features/deep-link/share-link.view.tsx:134` |
| Notification permission/settings read | `src/features/notifications/notification-switch.view.tsx:112` |
| Inbox pagination footer | `src/features/notifications/notifications.view.tsx:190` |
| Opening an inbox target | `src/features/notifications/notifications.view.tsx:222` |
| Search list pagination | `src/features/search/search.view.tsx:222` |
| Map pagination/refetch | `src/features/search/search.view.tsx:267` |
| Location permission/settings read | `src/features/settings/location-permission.view.tsx:101` |

Existing pull-to-refresh sites:

- `src/features/home/home.view.tsx:163`
- `src/features/home/home.view.tsx:170`
- `src/features/contributions/my-contributions.view.tsx:173`
- `src/features/contributions/my-contributions.view.tsx:186`
- `src/features/contributions/my-contributions.view.tsx:189`

`src/features/tabs/plans.view.tsx:223` now passes its pagination busy state to the shared button, so the existing load-more action also shows the mark.

## Submit/action sites inherited through the shared button

These existing busy-state bindings receive the SVG automatically; their mutation and form behavior stays in the existing owners.

- `src/features/account/account.view.tsx:409`
- `src/features/account/profile-defaults.view.tsx:118`
- `src/features/account/theme-accent.view.tsx:81`
- `src/features/active-date/active-date.view.tsx:475`
- `src/features/active-date/checkin-sheet.view.tsx:251`
- `src/features/assistant/confirmation-card.view.tsx:89`
- `src/features/assistant/confirmation-card.view.tsx:94`
- `src/features/assistant/history.view.tsx:351`
- `src/features/auth/sign-in.view.tsx:239`
- `src/features/create-date/create-mood.view.tsx:223`
- `src/features/date-plan/date-plan.view.tsx:265`
- `src/features/date-plan/place-report.view.tsx:52`
- `src/features/date-plan/place-reviews.view.tsx:178`
- `src/features/date-plan/plan-edit.view.tsx:217`
- `src/features/gogo-room/gogo-room.view.tsx:586`
- `src/features/gogo-room/gogo-room.view.tsx:597`
- `src/features/gogo-room/gogo-room.view.tsx:756`
- `src/features/gogo-room/gogo-room.view.tsx:762`
- `src/features/gogo-room/gogo-room.view.tsx:768`
- `src/features/gogo-room/guest-join.view.tsx:232`
- `src/features/gogo-room/join-by-code.view.tsx:161`
- `src/features/gogo-room/room-manage.view.tsx:184`
- `src/features/gogo-room/room-schedule-editor.view.tsx:122`
- `src/features/gogo-room/room-title-editor.view.tsx:88`
- `src/features/home/home.view.tsx:237`
- `src/features/home/quick-join.view.tsx:71`
- `src/features/matching/match-result.view.tsx:341`
- `src/features/matching/match-result.view.tsx:348`
- `src/features/matching/match-result.view.tsx:372`
- `src/features/matching/preference.view.tsx:203`
- `src/features/matching/suggestion-run-notice.view.tsx:101`
- `src/features/matching/suggestion-run-notice.view.tsx:107`
- `src/features/onboarding/onboarding.view.tsx:155`
- `src/features/place-import/contribution-wizard.view.tsx:95`
- `src/features/place-import/contribution-wizard.view.tsx:100`
- `src/features/place-import/existing-place-result.view.tsx:48`
- `src/features/place-import/import-photos.view.tsx:64`
- `src/features/place-import/import.view.tsx:381`
- `src/features/review/my-reviews.view.tsx:275`
- `src/features/review/review.view.tsx:323`
- `src/features/tabs/plans.view.tsx:223`
- `src/features/tabs/profile.view.tsx:168`
- `src/features/tabs/saved-link.view.tsx:67`

This includes sign-in/sign-up; import verification, wizard draft save and submit; account/defaults/theme save; review submit/edit/report; room create/join/title/schedule/constraints; check-in; stop completion; matching/regeneration/finalization; assistant confirmation/history editing; saved-link save; export and logout.

## List first loads

- `src/features/notifications/notifications.view.tsx:161` — inbox rows use `RoomMemberSkeleton`.
- `src/features/contributions/my-contributions.view.tsx:165` — place-card skeletons for contributions, row skeletons for the reviews tab; offline handling remains in place.
- `src/features/review/my-reviews.view.tsx:143` — personal-review rows use `RoomMemberSkeleton`.
- Existing Home/Search/Saved/Plans/place-review/assistant first-page skeleton paths remain in use.

## ActivityIndicator audit

`rg -n ActivityIndicator src` returns no matches. No retained ActivityIndicator exceptions. Native RefreshControl is the justified platform fallback described above. Audit and exact-source checks: `/tmp/584-activity-audit.log`.

## Validation

Results are recorded in `/tmp/584-typecheck.log`, `/tmp/584-lint.log`, and `/tmp/584-test-ui.log`.

- `pnpm typecheck`: PASS, exit 0.
- `pnpm lint`: PASS, exit 0, no warnings.
- `pnpm test:ui` (no filter): PASS, exit 0; 219 suites, 3,002 tests, 9 snapshots. Jest emitted a worker teardown warning (one worker was force-exited); no test failed. The warning's source was not isolated.
- `git diff --check`: PASS.

- `src/shared/ui/__tests__/loading-indicator.spec.tsx:23` — Light/Dark, all three ground variants, spectrum/crossover, labelled busy button, duplicate-press suppression, themed refresh/header lifecycle, static until OS answer, running-to-reduced transition and cancellation.
- `src/features/__tests__/loading-list.spec.tsx:29` — Light/Dark first-page skeleton, pagination indicator, then no indicator when finished.
- Existing button/tint/list expectations updated in `button.spec.tsx`, `button-neutral.spec.tsx`, `accent-foreground.spec.tsx`, `home-location-scope.spec.tsx`, and `my-contributions.spec.tsx`.
- Native device/simulator appearance and animation were not exercised in this task.
