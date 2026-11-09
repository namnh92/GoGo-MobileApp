# GoGo-MobileApp #539 — Group 10 notifications

Current basis: `feature/GOGO-539-redesign-g10-notifications`, `d3012e3`, worktree `mobile-g10`, PR #573. Continuation date: 2026-11-09. UI + API wiring against BE `origin/re-design` at `a9c84a728964676cc36a9776cb0bb268c4ad9c50` (BE#812). Owner confirms DEV deployment and inbox backfill; this continuation does not independently claim DEV acceptance. No commit or push.

The vendored client contract pin is `openapi/gogo.v1.yaml` → **7.7.0-alpha.1** (repo convention: ADR-0001). Copied verbatim with `git -C /Users/maxnguyen/MyWorks/GoGo/GoGo-BE show origin/re-design:openapi/gogo.v1.yaml > openapi/gogo.v1.yaml`; generated with **`pnpm api:types`** (`openapi-typescript openapi/gogo.v1.yaml -o src/shared/api/schema.d.ts`). Existing CI `pnpm api:check` regenerates and compares this same vendored contract; no hand edits to generated types.

Initial UI-only basis was `f28f617`; the original visual evidence below remains historical.

Owner instruction [2026-11-08](https://github.com/namnh92/GoGo-MobileApp/issues/539#issuecomment-6721242112): “Làm song song đi. Có API thì ghép sau”. This supersedes the earlier wait-for-BE comment. The current task also confirms Later = mark read only; reminders 120 minutes before confirmed start; quiet hours default off, 23–07 opt-in, defer push, no emergency exception; no automatic cleanup. Read `dev/handoffs/g10-plan.md` and `sa-shape-be-811.astra.md` in full, plus core/design-system/stitch-design rules. The referenced `RTK.md` was not found in the checkout or workspace/ancestor searches.

Stitch project `17315762413421369447`; inspected both live HTML and full screenshots via Stitch MCP:

| Screen | Screen ID | HTML file | Screenshot file |
| --- | --- | --- | --- |
| 10.1 Inbox | `1871420597720396095` | `1871420597720396493` | `1871420597720398342` |
| 10.2 Settings | `13490501616325201280` | `13490501616325200330` | `13490501616325200805` |

Only Light references were supplied; the previous full-project handoff found no Dark pair. Dark uses the same components, layout and strings through existing shared role tokens (`theme.redesign`, `theme.accent`). No screen-named colours or raw colours added. No claim of pixel parity: **0/2 screens have app/Stitch side-by-side image verification**. `xcrun simctl list devices booted` failed with CoreSimulatorService connection invalid/refused and sandbox log permission denial. Actual device rendering, font scaling and theme/accent visual QA remain unverified.

## Deviation table

| Screen / Stitch element | Implemented behavior | Basis / unlock |
| --- | --- | --- |
| Both: custom back/menu/avatar header | Shared `AppHeader`, inbox bell omitted; no inactive menu | Owner #535, shared header rule |
| 10.1: “N mới” total badge | Exact summary unreadCount; shared bell/profile use the same account query | Contract 7.7.0-alpha.1 / BE#812 |
| 10.1: “Đọc tất cả” | POST summary cutoff with Idempotency-Key; poll running operations; busy/disabled until completion and list+summary refetch | Contract 7.7.0-alpha.1 / BE#812 |
| 10.1: category chips | Shared Chip, All selected; remaining filters disabled with visible reason | No server filter in generated `listNotifications` query; BE#811 optional filter follow-up; never filter only loaded pages |
| 10.1 / 10.2: incoming invitation text | “Thành viên vào phòng”; host-facing joined-room copy; `inviterName` explicitly identified as creator of the invitation | ADR-0039 R-02: current `member.joined` targets HOST; not evidence that recipient was invited |
| 10.1 / 10.2: request to choose preferences | Preference progress/update copy for the host; N-member progress from real payload | ADR-0039 R-02: `preferences.completed` targets host |
| 10.1: inviter portrait | 48px shared kind icon with 20px overlaid type badge | No inviter avatar in generated payload; no sample portrait |
| 10.1: room names, campaign text, progress, stop/change counts | Real payload fields only; old rows retain bounded first-five room-name fallback; unknown kinds remain readable | Generated payload from #753 exists at this Mobile basis; no per-card plan/place requests |
| 10.1: fixed “perfect” plan preview, photos, start time | Omitted | No event-time preview/media facts in generated payload; BE#811 slice 3 |
| 10.1: changed time “19:00” | Structured real added/removed/reordered/duration/lock/optional facts instead | No new appointment time field; core §§8,15 |
| 10.1: “còn 2 tiếng”, place/address | Generic outing-update copy; fixed lead-time/venue/address omitted | Existing kind does not establish scheduled reminder; BE#811 slices 3–4 |
| 10.1: invitation actions | View room uses existing resolver; Later calls only single-read, never navigation, decline or revoke; already-read Later disabled | Owner 2026-11-08; concurrent per-ID read deduplication, shared result error sheet |
| 10.1: card buttons | Shared button family; first invitation card can have one filled primary, later card navigation secondary | Shared Button rule, one dominant primary; no local button styles |
| 10.1: empty illustration/copy | Shared mail glyph on circular surface, neutral location-free copy, reload action | Shared icon system; no sample city or claim that all pending invitations were handled |
| 10.1: seven-day cleanup footer | Removed | Owner: NO automatic cleanup |
| 10.1: settings entry | Ghost action opens `/settings/notifications` | Dedicated 10.2 route from task/handoff; working navigation |
| 10.2: route shared with group 11 | Dedicated notification screen. Profile permissions entry now opens `/settings/permissions`; legacy `/settings/location` retains permissions screen | Group 10 handoff route split; existing location/tracking access preserved; telemetry template added |
| 10.2: device banner and Settings | Permission lifecycle shared with legacy section; banner before master; Settings always available, SDK/Settings errors recoverable | Existing device permission API and `Linking.openSettings`; no BE dependency |
| 10.2: “on this phone” master copy | Account-wide/all-device copy, separate from OS permission | Existing GET/PUT contract, ADR-0025/0039 |
| 10.2: live sync/sample account/count | Real loaded master state/inbox note only; no fictional account, live-sync assurance or 5/5 count | No account/count/category response fields |
| 10.2: five category switches, Enable all | Visible but disabled, explicit reason that values do not represent account preferences; no legacy preferences writes | Generated client has neither category fields nor PATCH; BE#811 slice 2 |
| 10.2: legacy master when new category response appears | Also disabled, including the legacy permissions section | Prevent PUT(true) from resetting newer category choices before the PATCH adapter exists |
| 10.2: quiet-hours card | Default off/disabled switch, 23–07 opt-in/defer semantics, no sound-muting claim, no emergency exception; explicit unavailable reason | Owner 2026-11-08; BE#811 slice 4; no local timer or saved fake preference |
| Both: async/feedback states | Layout skeleton, empty, recoverable errors, offline initial state, cached stale notice, guest gate; shared ResultSheet with shared one-row SheetActions | core §10, shared component and #547 rules |
| Both: Dark | Same layout/text/components via shared Dark tokens | Issue #539 permits token-derived Dark without Stitch pair; image verification remains outstanding |

## Central capability gate and BE unlocks

`src/features/notifications/notification-capabilities.ts` is the only capability decision point. Absent operations/fields are compile-checked against generated `paths`/`NotificationSettings`/inbox query types. Only summary and read-all are open at this basis; category preferences/filtering and quiet hours remain closed. Contract regeneration intentionally produces a type error for a newly present operation/field, forcing real adapter wiring before activation. A backend deploy alone cannot silently activate a control or call a speculative endpoint. Runtime response guards also lock legacy master writes if `categories` appears before client regeneration. The reused master section uses that guard; the permissions page has only a read-only navigation row after the UI unification below.

| Gated control / content | Contract requirement | BE PR / remaining work |
| --- | --- | --- |
| Total “N mới”; shared bell total | GET `/me/notifications/summary`; one shared account-scoped query, invalidated on reads | Wired: `useNotificationSummary`, key `['me', 'notification-summary']`, bell/profile/inbox share it; excluded from disk persistence |
| Read all | POST `/me/notifications/read-all`, summary cutoff, idempotency key, operation polling to completion | Wired: key stable through automatic retries; 1-second authenticated polls while running; session abort clears timer and blocks late responses/refetches |
| Members/plans/appointments filters | Server-side category filtering with cursor bound to filter | BE#811 optional filter follow-up. #812's published scope does not promise this filter; no separate PR found |
| Five category toggles, Enable all, configured count | GET categories/version + PATCH `/me/notification-settings`, ETag/If-Match and Idempotency-Key; atomic five-true PATCH leaves master unchanged | BE#811 slice 2, **no PR number found** at verification; do not use legacy per-kind preferences |
| New category-preserving master (when response has categories) | Real PATCH adapter; legacy PUT(true) resets all categories | BE#811 slice 2, no PR found; legacy master works only for old response shape |
| Plan/reminder preview facts and avatar | Optional sourced payload fields; historical omissions remain valid; independently approved media if added | BE#811 slice 3, **no PR found**; current proposed preview shape also has no avatar/media IDs, so imagery needs an additional contract |
| Scheduled 120-minute reminder | Authoritative confirmed start + scheduled reminder facts and scheduler | BE#811 slice 4, **no PR found**; no scheduler emulated in Mobile |
| Quiet hours switch | Stored enabled/window/IANA zone plus server deferral behavior | BE#811 slice 4, **no PR found**; default off until real support |

PR lookup via GitHub connector on 2026-11-08 found #812 (PR 1/4) under #811. Other slice numbers are ADR sequence descriptions, **not invented PR numbers**. Read-only source access used the GitHub connector because `gh issue view` could not reach api.github.com. No GitHub writes performed.

## Verification

- New rendered state matrix covers default/loading/empty/error on each screen, initial offline and cached degradation, guest cache isolation, OS denial, absent API controls, real payload details, mark-read/open, Later/double-tap/read error, master save/success/failure, legacy-response upgrade guard, and English copy.
- Existing resolver race, blur, stale-plan/access, push fallback, settings lifecycle and hook rollback tests retained. Dynamic i18n key registry and routed-header inventory updated, not weakened.
- Relative time uses numerical event age + vi/en catalog plurals, without depending on Hermes support for `Intl.RelativeTimeFormat`.
- Existing JEV harness discovered via installed integration; `jev-prompt status` reported configured/active and `status` reported the real OpenRouter model history. No new live advisory response or approval claimed.

Historical UI-only command exits and suite counts (2026-11-08): Logs are `/tmp/g10-typecheck.log`, `/tmp/g10-lint.log`, `/tmp/g10-test.log`, `/tmp/g10-test-ui.log`, `/tmp/g10-focused-ui.log`, and `/tmp/g10-route-tests.log`.

| Command | Exit / result | Log |
| --- | --- | --- |
| `pnpm typecheck` | 0 | `/tmp/g10-typecheck.log` |
| `pnpm lint` | 0, no warnings | `/tmp/g10-lint.log` |
| `pnpm test` | 1: 1677 passed, 39 skipped, exactly the 3 supplied baseline sandbox lock failures in `distribute-wrapper.test.ts`; no group 10 failure | `/tmp/g10-test.log` |
| `pnpm test:ui --runInBand` | 0: 209 suites, 2821 tests passed | `/tmp/g10-test-ui.log` |
| Focused notification/settings/route/i18n UI suites | 0: 12 suites, 269 tests passed | `/tmp/g10-focused-ui.log` |
| Header ownership and profile route tests | 0: 58 passed | `/tmp/g10-route-tests.log` |
| `git diff --check` | 0 | Working-tree validation |

The new state matrix lives in `src/features/__tests__/notifications-g10.spec.tsx`; event-age boundary tests live in `src/features/notifications/__tests__/notification-time.test.ts`. Tests use fixtures only; production UI contains no fake notifications, optimistic category data, speculative endpoint calls or local implementations of backend policies.

After the final Dark badge fill correction, the group 10 rendered matrix was rerun: **21/21 passed**, `/tmp/g10-state-matrix.log`.


## Contract 7.7 continuation verification (2026-11-09)

- Bell dot and exact “N mới” derive from the same summary, independent of loaded inbox pages and push preferences. Missing summary never fabricates an inbox total. Read-all requires a usable summary cursor and a positive unread count; missing/error/paused summary disables the action.
- Read-all sends the opaque cutoff unchanged and uses the returned status for both 200 and 202. Polling keeps the control busy; completion invalidates/refetches list and summary. New arrivals above the cutoff remain whatever the new summary reports; no optimistic zero or local readAt overwrite.
- Failure keeps unread content, shows the shared error sheet and offers reload of both sources. Existing single-read refreshes both sources too. Cursors remain opaque end-to-end.
- The existing account lifetime cache binding removes summary on account transition; polling uses the same generation for every HTTP call and aborts even when transport ignores cancellation. Summary/cutoff is not persisted to disk.
- Regression coverage: shared query deduplication, bell dot, exact Light/Dark count, read-all 200/202/running/error, double-tap/pending controls, automatic retry idempotency, waiting/in-flight cancellation, gate values, opaque cursor HTTP encoding and real adapter request bodies/headers. Existing routing/settings tests retained.
- Light/Dark are verified in the rendered component matrix using shared semantic tokens; simulator/device screenshots and authenticated DEV smoke were not run in this continuation.

| Command | Exit / result | Log |
| --- | --- | --- |
| `pnpm api:types` | 0; generated with openapi-typescript 7.13.0 | `/tmp/g10c-codegen.log` |
| `pnpm typecheck` | 0 | `/tmp/g10c-typecheck.log` |
| `pnpm lint` | 0; no warnings | `/tmp/g10c-lint.log` |
| `pnpm test` | 1; 1680 passed, 39 skipped, 3 unrelated distribution-lock failures | `/tmp/g10c-test.log` |
| `pnpm test:ui --runInBand` | 0; 210 suites, 2841 tests passed | `/tmp/g10c-test-ui.log` |
| `pnpm api:check` | 0 | `/tmp/g10c-api-check.log` |
| Focused notification hooks/UI/bell | 0; 3 suites, 45 tests passed (also covered by full UI run) | `/tmp/g10c-focused-ui.log` |
| Focused real notification HTTP adapters | 0; 3 tests passed (also covered by full unit run) | `/tmp/g10c-focused-api.log` |

The three full-unit failures are in unchanged `src/shared/config/__tests__/distribute-wrapper.test.ts`: owner-alive check (line 208, unavailable `ps` stdout), build-group recovery (line 234), and keeping a live build's lock (line 258). This sandbox denies `ps` (`operation not permitted`); the two group checks also observe an incorrect zero exit under that restriction. The earlier UI-only verification recorded these same three sandbox failures. No distribution scripts or tests were modified. `git diff --check` passes.


## Unified settings UI continuation (2026-11-09)

Owner instruction: [one notification settings screen](https://github.com/namnh92/GoGo-MobileApp/issues/539#issuecomment-6724345198). This continuation changes UI only, preserving the pre-existing uncommitted contract/API wiring. Branch remains `feature/GOGO-539-redesign-g10-notifications`, head `d3012e3`; no commit, push, merge or deployment.

- `/settings/notifications` renders the existing `NotificationSwitchSection` instead of a second master implementation. Its account value, GET/PUT mutation, optimistic rollback (owned by the unchanged query hook), retry payload, migrated/legacy explanation, pending lock and category-response guard remain intact. It retains the original inline failure/retry feedback; the duplicate screen-local success/result-sheet implementation is removed. Loading skeleton, initial offline state and cached stale notice remain supported.
- Device permission is shown separately on that screen. Denial opens system settings; permission is re-read on focus and foreground return, and an open-settings error remains recoverable. The five categories, Enable all and quiet hours stay disabled with explicit reasons; no preference API is enabled.
- Permissions replaces its notification control block with one `Thông báo` row. Account on/off is displayed only after a usable read; device denial takes precedence as `Bị chặn trong cài đặt máy`. Checking/unknown states remain explicit. The row exposes its status to assistive technology and opens `/settings/notifications`; signed-out people use the same entry and retain their separate device-promotions section.
- Inbox replaces the footer text button with an accessible gear through `AppHeader.rightAction` / `AppHeaderAction`. One settings entry remains reachable in loaded, empty, loading, error, offline and guest states.
- New vi/en status strings use sentence case. Rendered Light/Dark checks cover the settings controls and permissions row, shared card colors and target size, plus gear navigation. No simulator/device screenshot or authenticated DEV acceptance is claimed.

### Coordination with #567

Read-only GitHub verification found PR #567 still **open/unmerged**, head `63897c5a1f47ba0abcbe1601e38f5bac3fd3f4de`, base `re-design`. It is absent from this branch. The system-settings section and its open-settings/error logic are untouched; the permissions diff is limited to the notification block and its now-unused imports/comment. Expected rebase after #567 lands: retain its merged system-settings layout/alignment and catalog sentence-case edits while keeping this single notification row. No rebase performed over the dirty tree.

### Verification

Regression-before evidence: `/tmp/g10d-before-ui.log` records **8 intended failures, 32 passes** for missing row/status/navigation and the footer settings entry. The original master/device lifecycle tests now render the dedicated settings screen, retaining the exact mutation/rollback/retry expectations. Location tests isolate the new navigation row; computed i18n status keys are registered in the catalog audit.

Final command results: Unit failures remain the same three pre-existing sandbox distribution-lock cases at `distribute-wrapper.test.ts:208`, `:234`, `:258`; neither that script nor those tests was changed. Current output again shows unavailable `ps` stdout for the owner check and incorrect zero exits for the two process-group checks.


| Command | Exit / result | Log |
| --- | --- | --- |
| `pnpm typecheck` | 0 | `/tmp/g10d-typecheck.log` |
| `pnpm lint` | 0; no lint warnings | `/tmp/g10d-lint.log` |
| `pnpm test` | 1; 1680 passed, 39 skipped, 3 existing distribution-lock failures | `/tmp/g10d-test.log` |
| `pnpm test:ui --runInBand` | 0; 210 suites, 2860 tests passed | `/tmp/g10d-test-ui.log` |
| Focused G10/permissions-theme/location/i18n checks | 0; 3 suites, 88 tests passed | `/tmp/g10d-focused-ui.log` |
| `git diff --check` | 0 | Working-tree validation |

Code/test/contract snapshot: `rs-1101601764a4`, `/tmp/g10d-snapshots/g10d-rs-1101601764a4/MANIFEST.txt` (scopes `src`, `openapi`; verification prose excluded). Includes the preserved API work. Created after the final UI edits, with no code changes while the final checks completed; verified unchanged before handoff. The final UI log is complete, contains no null bytes and records the 2860-test result.

### Files and lines changed in this UI continuation

| File:line | Change |
| --- | --- |
| `src/features/notifications/notification-settings.view.tsx:33` | Reuse the original master/device section; keep category/quiet-hours gates |
| `src/features/notifications/notification-settings.style.tsx:5` | Remove styles owned by the removed duplicate master/device UI |
| `src/features/notifications/notification-switch.view.tsx:39` | Canonical master section, unchanged mutation/rollback/retry semantics; async/device UI |
| `src/features/notifications/notification-switch.style.tsx:6` | Standalone cards, spacing, loading skeleton |
| `src/features/notifications/notification-settings-row.view.tsx:14` | Read-only permission/account status and navigation |
| `src/features/notifications/notification-settings-row.style.tsx:5` | Shared-token row layout and touch target |
| `src/features/settings/permissions.view.tsx:41` | One notification row; system-settings section unchanged |
| `src/features/notifications/notifications.view.tsx:149` | Shared header gear; remove footer text button |
| `src/shared/i18n/vi.ts:1641` / `src/shared/i18n/en.ts:1654` | Three status strings; Vietnamese system-notification settings CTA sentence case at `vi.ts:1653` |
| `src/features/__tests__/notification-settings.spec.tsx:51` | Original master/device regressions now run against the dedicated screen |
| `src/features/__tests__/settings-permissions.spec.tsx:90` | Single row, statuses, navigation |
| `src/features/__tests__/notifications-g10.spec.tsx:199` | Light/Dark settings; header gear/state/locale navigation at `:341`; Light/Dark vi/en permissions row at `:378` |
| `src/features/__tests__/location-settings.spec.tsx:29` | Isolate the replacement notification row in location tests |
| `src/features/__tests__/i18n-keys.spec.tsx:110` | Register the typed dynamic status keys |
| `docs/verification/issue-539-group-10.md:114` | This continuation, #567 coordination and verification evidence |

## Owner simulator follow-up — PR #573, 2026-11-09

Basis: `5008cbe`, same worktree/branch. Owner reports signed-in chips cannot be tapped and requests client filtering now, public system rows for both session states, all kind variants and a proxy-ready JSON fixture. This dated instruction supersedes the historical filter-disabled deviation above. UI/client adapters only; no generated contract edits, backend changes, commit or push.

- Chips now select All / Members / Plans / Appointments / System-other. Mapping is exactly `invite` → Members; `preference_reminder`, `plan_ready`, `plan_changed` → Plans; `date_reminder` → Appointments; every other/missing kind → System-other. Selection uses the shared raised Chip highlight, heavier Inter-SemiBold face (unselected Inter-Medium), and accessibility selected state. The unavailable-filter catalog line was removed.
- `useNotificationFilter` is the BE#811 PR2 replacement seam. It selects over the shared loaded pages, automatically follows opaque next cursors until at least ten matches or exhaustion, and stops on error/offline or account read disable. Requests use `cancelRefetch: false` to deduplicate concurrent automatic/list-end pagination. Changing chips reuses the same account cache and never re-labels an old response as a server-filtered response. Filtering never changes the summary total or read-all cutoff. No-match copy is exactly `Không có thông báo loại này`; loading has a footer and does not flash this empty state. Pagination errors remain retryable.
- BE#815 public fetch is isolated in `src/shared/api/system-notifications.ts`, runtime-validated with zod against `{ items: [{ id, kind, title, body, deepLink, publishedAt, expiresAt }], nextCursor }`. It omits Authorization, treats only HTTP 404 as the old-backend capability result, and leaves transport/other HTTP/schema failures as errors. The hook follows `nextCursor`; both signed-in and signed-out use the same section above personal content, with the existing unavailable illustration/copy or `Chưa có thông báo hệ thống`. Valid supported app links open through the existing parser/router; unsupported links have no CTA. Public rows have no fabricated unread state. Their public memory cache survives session transitions; it is not persisted to disk. Replace the narrow adapter with generated types/endpoint after the 7.8.0 contract lands.
- `test/fixtures/notifications-full-case.json` is a development/test-only GET-inbox envelope: exactly one realistic row for each of nine kinds, fake UUIDs, UTC timestamps and mixed omitted/present `readAt`. Every top-level field is declared by the vendored OpenAPI Notification schema; `exportId`/`expiresAt` use its explicitly free-form payload (also documented by NotificationKind). No null `readAt`, avatar, media, venue, schedule or invented preview fields. Production code never imports the fixture; the owner's proxy can serve it as-is.

### Fresh Stitch comparison

Read live HTML and the complete screenshot of `Thông báo - GoGo`, screen `1871420597720396095` in project `17315762413421369447`; HTML file `1871420597720396493`, screenshot file `1871420597720398342`. The supplied screenshot depicts five personal row kinds; it does not depict campaign/moderation/export/unknown or a public-system section. Those use the shared row structure and neutral fallback roles; no unsupported pixel-parity claim is made.

| Kind | Tile / title role and payload rendering | Actions / remaining data gap |
| --- | --- | --- |
| invite | 48px violet tile, violet title, type badge, real roomName and inviterName, relative time/unread dot | View room only with a valid room target; Later preserves mark-read-only semantics. No sourced portrait; host-facing joined-member semantics retained (ADR-0039). |
| preference_reminder | Violet tile with dining icon (corrected to violetInk), accent title, real roomName and validated N-member progress pill | View room when supported; progress does not claim the host must complete someone else's preferences. |
| plan_ready | Green tile/title and map badge, real roomName/stopCount, time/unread | View plan when supported. Event-time place/media/start-time preview still unavailable in 7.7 payload. |
| plan_changed | Neutral history tile/title and calendar badge, real structured added/removed/reordered/duration/lock/optional facts | View plan when supported. No new appointment time in current payload, so no fabricated changed-time sentence. |
| date_reminder | Neutral tile, accent bell/title, real room context, time/unread | View plan when supported. No confirmed start/venue/address/120-minute facts in this contract. |
| moderation_update | Neutral info tile/title, localized result copy, time/unread | No destination/status facts sufficient for another CTA. |
| campaign | Neutral tile/title, actual CMS title/body with localized fallback, time/unread | No supported destination in the fixture; no invented destination CTA. |
| privacy_export_ready | Neutral lock tile, dedicated localized export title/body and actual expiry when present, time/unread | No authenticated export artifact route in this screen; no authorization URL fabricated. |
| unknown (including missing/future kinds) | Neutral bell tile, readable localized fallback title/body, time/unread | No invented navigation CTA; row can still mark read. |

Shared Card/Chip/Button/typography and semantic theme roles cover Light and Dark. Existing owner decisions still govern the shared AppHeader and absence of automatic seven-day cleanup. This turn compares implementation roles/content with the live Stitch source and renders tests in both themes; **simulator screenshots, side-by-side pixel parity and authenticated DEV acceptance remain unverified**.

### Verification for this continuation

The pre-fix mechanism is directly visible at `5008cbe`: the three category controls have `disabled={!capabilities.categoryFilter}` with `categoryFilter: false`, and the system hook returns only `unsupported` without a request. Owner's signed-in simulator report is the reproduction evidence. New regression coverage taps every chip in Light/Dark and exercises real infinite-query pagination; it also covers cursor exhaustion, no matches, ten-match stop, in-flight chip changes, failures/retry, disabled account reads, public pagination/404 recovery, no bearer, schema validation and session-cache transitions. Every fixture kind is rendered separately in both themes with title/body/facts, tile role, time, unread/read and supported actions checked.

| Command | Exit / result | Log |
| --- | --- | --- |
| `pnpm typecheck` | 0 | `/tmp/573v-typecheck.log` |
| `pnpm lint` | 0, no warnings | `/tmp/573v-lint.log` |
| `pnpm test:ui --runInBand` (no test filter) | 0; 220 suites, 3103 tests, 9 snapshots passed | `/tmp/573v-test-ui.log` |
| `pnpm test src/shared/api/__tests__/system-notifications.test.ts src/shared/api/__tests__/session-public-cache.test.ts` | 0; 2 files, 15 tests passed | `/tmp/573v-api.log` |
| `git diff --check` | 0 | Working-tree validation |

Source/test evidence snapshot: `rs-d22628791381`, generated by the workspace snapshot tool with scopes `src` and `test` (verification prose excluded), manifest `/tmp/573v-snapshots/573v-rs-d22628791381/MANIFEST.txt`. It retains the tracked patch and new files; generated client and vendored OpenAPI remain unchanged. The source/test scope was verified unchanged after the checks. No device build, simulator acceptance, full Vitest run, commit or push is claimed.


## PR #573 follow-up — inbox failures and server filters (2026-11-09)

Owner's local-proxy reproduction covers list + summary HTTP 503 after a cached empty page and forced empty responses. The personal inbox now renders one combined stale notice; its retry refetches list and summary together. A failed list without cached pages keeps the shared ErrorState and retry inside the list card, with no empty-state copy. The unread badge requires a positive, known, non-error/non-paused summary. Read-all is hidden when unavailable (zero/unknown/error summary, empty/loading/error/paused list), and remains visibly disabled during its pending operation.

Chips send repeatable `kinds` on the first page and every server-filtered cursor page: invite; plan_ready/plan_changed/preference_reminder; date_reminder; campaign/moderation_update/privacy_export_ready. Each category has its own account-scoped query key; single/read-all invalidation covers every category. Only an initial filtered HTTP 400 negotiates the old-BE client fallback. That fallback restarts without a cursor and carries its unfiltered cursor mode through subsequent pages. A server-filtered cursor is never replayed without kinds. Other errors stay errors; a later fresh refetch probes server support again so a BE deploy does not require an app restart.

This is Mobile wiring only, per the owner's supplied BE#811 PR2 contract. The endpoint wrapper temporarily extends the generated query with generated NotificationKind values; vendored OpenAPI and generated schema stay unchanged pending the published BE contract. No backend edits, commit, push, simulator acceptance or deployment claim. Previous uncommitted work remains in this worktree.

Regression proof renders cached-empty, cached-populated and uncached errors in Light/Dark; checks one stale banner and combined retry, zero/unknown/error badge suppression, and no dead read-all. Hook tests cover all four kinds maps, separate caches, cursor binding, old-BE sparse-page fallback, failed-page retry, non-400 errors, disabled reads and invalidation across filters. The API test verifies repeated query serialization and opaque cursor round-trip.

Verification logs: `/tmp/573w-typecheck.log`, `/tmp/573w-lint.log`, `/tmp/573w-ui.log`, `/tmp/573w-api.log`. The default parallel UI run passed the inbox suites but encountered one unrelated act-warning timing failure in create-time-day; retained at `/tmp/573w-ui-parallel.log`. The full serial rerun uses `pnpm test:ui --runInBand` with no test filter.


Final checks: `pnpm typecheck` exit 0; `pnpm lint` exit 0; `pnpm test:ui --runInBand` exit 0 (220 suites, 3127 tests, 9 snapshots); targeted notification-inbox API tests exit 0 (4 tests); `git diff --check` exit 0. UI coverage includes both Light and Dark. The serial UI run retained all tests with no test filter. No simulator rerun was performed.

## PR #573 — unified signed-in system notifications (2026-11-09)

Owner simulator feedback (real DEV data, BE#816 reported live): system notifications belong inside “Tất cả thông báo” with a child “Hệ thống” chip; the separate section remains only when signed out. This continuation follows that explicit UI scope and retains the prior branch changes. No backend, generated contract, commit or push changes.

- Signed in: one feed sorts personal `createdAt` and public `publishedAt` newest first. The existing public row component is shared between the merged feed and signed-out section; public rows have no unread indicator or mark-read handler. The summary count and read-all cursor remain exclusively backend personal-inbox values. Read-all is hidden on the public-only chip and when no personal rows are loaded.
- Chip order: Tất cả / Thành viên / Kế hoạch / Lịch hẹn / Khác / Hệ thống, using the same shared Chip component, selected state and theme tokens. The existing internal personal category `system` and its server kinds remain unchanged; its visible label is now “Khác”. The new public chip uses the unfiltered personal query cache without consuming its pagination and displays only public rows.
- Public pages automatically load when signed in, up to five pages. When the personal cursor has more pages, public rows older than the oldest loaded personal row wait behind that boundary. Initial personal loading establishes the boundary before interleaving; cursor exhaustion releases the remaining public tail, including when the personal inbox is empty. The public-only chip displays the complete loaded public collection immediately. Signed-out public pagination remains manual.
- A failed initial or later public request preserves the personal feed, badge and read-all; a small inline message/retry targets only the public query. Existing public rows remain available after a later-page error. Public loading/empty/offline states also leave personal rows usable. Signed out, the separate public section and personal sign-in prompt remain unchanged and cached private rows stay hidden.

Regression evidence: `/tmp/573y-before-ui.log` records 26 failing updated/new expectations before implementation (110 existing tests passed). `/tmp/573y-focused-ui.log` records 143 passing focused tests after the main implementation, before the final initial-boundary and pagination UI cases. New screen scenarios run in Light and Dark and cover merge order/page boundaries, exhausted/empty inbox, every chip, read-state isolation, public failures with/without cache, loading/offline/empty isolation and signed-out layout. Real-query hook tests cover deduplication, opaque cursors, five-page stop, sign-in transition and failed-page recovery. `/tmp/573y-ui-pre-final.log` is an interrupted intermediate run containing a test-helper error corrected before the final run.

Final requested gates (all exit 0):

| Command | Result | Log |
| --- | --- | --- |
| `pnpm typecheck` | Pass | `/tmp/573y-typecheck.log` |
| `pnpm lint` | Pass; no warnings | `/tmp/573y-lint.log` |
| `pnpm test:ui --runInBand` (no test filter) | 220 suites, 3177 tests, 9 snapshots passed | `/tmp/573y-test-ui.log` |
| `git diff --check` | Pass | `/tmp/573y-diff-check.log` |

The nine changed source/test files are recorded in `/tmp/573y-source.sha256` and verified unchanged after the final checks. The worktree retains the patch for review; no commit or push was performed. This continuation does not claim a simulator rerun or authenticated DEV acceptance.
