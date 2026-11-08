# GoGo-MobileApp #539 — Group 10 notifications

Basis: `feature/GOGO-539-redesign-g10-notifications`, `f28f617` (`origin/re-design` supplied by owner). UI only; no generated contract edits, commit, push or backend changes. Date: 2026-11-08.

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
| 10.1: “N mới” total badge | Hidden; no page-length total substituted | Generated client has no summary; BE#812 |
| 10.1: “Đọc tất cả” | Visible, disabled with visible reason and accessibility hint | Missing read-all; BE#812; core §16 |
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

`src/features/notifications/notification-capabilities.ts` is the only capability decision point. Absent operations/fields are compile-checked against generated `paths`/`NotificationSettings`/inbox query types. All new capabilities are closed at this basis. Contract regeneration intentionally produces a type error for a newly present operation/field, forcing real adapter wiring before activation. A backend deploy alone cannot silently activate a control or call a speculative endpoint. Runtime response guards also lock legacy master writes if `categories` appears before client regeneration. Both notification settings surfaces use that guard.

| Gated control / content | Contract requirement | BE PR / remaining work |
| --- | --- | --- |
| Total “N mới”; shared bell total | GET `/me/notifications/summary`; one shared account-scoped query, invalidated on reads | [BE#812](https://github.com/namnh92/GoGo-BE/pull/812), slice 1. Regenerate client and replace the existing bell's approximate first-page source with the same summary adapter; do not add an inbox-only count |
| Read all | POST `/me/notifications/read-all`, summary cutoff, idempotency key, operation polling to completion | BE#812, slice 1; rollout/backfill must be ready on DEV before wiring |
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

Final command exits and suite counts: Logs are `/tmp/g10-typecheck.log`, `/tmp/g10-lint.log`, `/tmp/g10-test.log`, `/tmp/g10-test-ui.log`, `/tmp/g10-focused-ui.log`, and `/tmp/g10-route-tests.log`.

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
