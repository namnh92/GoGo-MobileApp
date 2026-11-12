> Cập nhật round 6h (2026-11-12): màn Quản lý phòng đã bỏ; các ghi nhận
> manage bên dưới là bằng chứng lịch sử. Chức năng hiện tại nằm ở sảnh phòng;
> `/room/[roomId]/manage` chỉ redirect về sảnh. Xem
> [quyết định hiện hành](../redesign/issue-595-unified-room-edit.md#round-6h--quyết-định-owner-2026-11-12-10-thay-màn-quản-lý-phòng).

# GoGo-MobileApp #536 — shared Chip

Worktree: `mobile-536`; branch: `feature/GOGO-536-shared-chip`; base: `c947c80`.

## Common Component

- Canonical implementation: `src/shared/ui/chip.view.tsx`; theme styles: `src/shared/ui/chip.style.tsx`. The `primitives` barrel re-exports it. `TagChip`, `RatingChips`, and assistant `ContextChip` delegate to it.
- Variants: default / selected / disabled / info / positive / warning. Every label uses one line and tail ellipsis. Selection uses a distinct highlight, Inter SemiBold instead of Inter Medium, and `accessibilityState.selected`; no automatic check glyph. A passed check icon is suppressed when selected.
- Existing discovery, mood and soft appearances remain shared presets. Dark discovery/soft selection uses `redesign.moodSelected`, because the former dark selected and idle tokens were identical. Semantic and disabled variants retain their own theme foreground and surface.
- Disabled selected chips preserve their selection and cannot dispatch. Context chips retain an independent labelled remove action. Interactive chips keep hit slop.
- The external artifact tab has not been updated: its destination was not provided, and no connected document session was available. This section is the prepared Common Component entry.

## Migrated rendering surfaces

The following native/custom chip renderers now call the shared Chip. Superseded feature styles were removed. Handlers, API payloads, auth, navigation destinations and domain logic are unchanged. Button component sizing is untouched.

| File:lines | Migration |
| --- | --- |
| `src/features/account/theme-accent.view.tsx:47` | Personalisation label |
| `src/features/active-date/checkin-sheet.view.tsx:168` | Check-in tags |
| `src/features/assistant/context-chip.view.tsx:7` | Removable context |
| `src/features/assistant/follow-ups.view.tsx:36` | Quick replies |
| `src/features/assistant/proposal-edit.view.tsx:139` | Proposal choices |
| `src/features/assistant/result-card.view.tsx:72` | Rating metadata |
| `src/features/contributions/my-contributions.view.tsx:168` | Status filters |
| `src/features/create-date/create-mood.view.tsx:45, 182, 185, 188, 198, 207` | Add seed-place chip |
| `src/features/create-date/date-time-sheet.view.tsx:77, 203, 207` | Day shortcuts, evening slots, other-time shortcut; calendar and slot grid unchanged |
| `src/features/date-plan/place-reviews.view.tsx:165, 232` | Rating metadata |
| `src/features/gogo-room/gogo-room.view.tsx:715, 718, 721` | Host/guest tags |
| `src/features/gogo-room/guest-join.view.tsx:188` | Invitation tag |
| `src/features/gogo-room/room-manage.view.tsx:171` | Budget-tier chips |
| `src/features/home/home.view.tsx:191, 217` | Hero tag |
| `src/features/matching/match-result.view.tsx:292, 312, 347` | Hero tag |
| `src/features/matching/preference.view.tsx:163, 186` | Preference options and selected-count status |
| `src/features/matching/suggestion-run-notice.view.tsx:84` | Constraint tags |
| `src/features/matching/swipe.view.tsx:449, 474, 479, 513` | Category, distance and opening-state tags |
| `src/features/place-import/contribution-choices.view.tsx:44, 54` | Wizard steps 2/3: remove caller chip skins; retain selected state when disabled |
| `src/features/place-import/contribution-wizard.view.tsx:94, 252` | Step metadata and credit reward |
| `src/features/place-import/import.view.tsx:305, 315` | Community and synchronised-status tags |
| `src/features/tabs/profile.view.tsx:127` | Interest tags |
| `src/shared/ui/place-card.view.tsx:222, 268, 315, 317` | Saved/discovery card taxonomy tags |
| `src/shared/ui/rating-chips.view.tsx:22` | Google/GoGo rating chips |
| `src/shared/ui/primitives.tsx:52, 57` | TagChip delegates to Chip; legacy Chip export delegates to the canonical implementation |

## Existing consumers migrated through the shared export

These already called Chip; changing the shared implementation updates their selection, a11y and truncation together.

| File:lines |
| --- |
| `src/features/account/profile-defaults.view.tsx:183` |
| `src/features/active-date/active-date.view.tsx:403, 426, 427` |
| `src/features/active-date/date-finished.view.tsx:132` |
| `src/features/create-date/create-budget.view.tsx:73` |
| `src/features/create-date/create-location.view.tsx:190` |
| `src/features/date-plan/date-plan.view.tsx:443, 447` |
| `src/features/date-plan/place-detail.view.tsx:257, 276` |
| `src/features/date-plan/place-report.view.tsx:40` |
| `src/features/date-plan/plan-change.view.tsx:84, 98` |
| `src/features/date-plan/plan-edit.view.tsx:168` |
| `src/features/review/my-reviews.view.tsx:182, 188` |
| `src/features/review/review.view.tsx:234` |
| `src/features/search/search.view.tsx:200, 287, 296, 298, 302` |

Wizard amenity/checklist rows remain actual checkboxes; calendar cells, live rating input, pagination/score counters, illustration geometry and action buttons are not chips. The ownership test documents specific exemptions for these controls, including buttons owned by #541.

## Verification

- `pnpm typecheck`: exit 0.
- `pnpm lint`: exit 0; no warnings.
- `pnpm test`: exit 1; 137 suites passed, 1 skipped, 1 failed. 1,652 tests passed, 39 skipped; only 3 distribution-lock tests failed. `distribute-wrapper.test.ts:208` cannot read process start time because this sandbox denies `/bin/ps` (`operation not permitted`); the process-group checks at lines 234 and 258 fail under the same restriction. Distribution code/tests are unchanged. Chip ownership and accessibility gates passed.
- `pnpm test:ui --runInBand`: exit 0; 202 suites, 2,596 tests passed.
- Chip tests evaluate real stylesheet factories and foregrounds in all eight Light/Dark accent themes. They check single-line ellipsis, heavier selected text, distinct selected background, semantic colours, a11y state, disabled dispatch, and remove/press handlers. This is renderer coverage, not simulator validation.
- Ownership test scans feature JSX and the actual imported stylesheets; rejects native chip renderers and renamed capsule surfaces; includes negative fixtures and required call-site coverage.
- No commit or push.
