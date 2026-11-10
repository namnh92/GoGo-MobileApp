# Mobile #616 — credit visibility (BE #848 slice V)

Scope: Account tab credit balance → `/me/credits`, posted lifetime totals and private cursor history; current balance in the GoGo AI surface. No charging/admission, exhausted composer, welcome award, cost conversion or per-turn caption. The supplied V contract has no `creditsUsed` property.

## Contract and access

`openapi/gogo.v1.yaml` is copied byte-for-byte from the owner-supplied `gogo.v1.credits-v.yaml`; `pnpm api:types` retains the generated schema. The supplied version stays unchanged for later rebase. All DTOs derive from generated types. Endpoints use the existing authenticated BFF wrapper, with cancellation and session lifetime guards.

Only a registered actor with `GET /me` → `capabilities.assistantCredits === true` sees the entry or requests credit endpoints. Absence/false hides the entry and a direct history route shows unavailable. The BE capability reflects the independent default-off `assistant_credits.display_enabled` flag. Guests get sign-in with no personal credit request or cached facts rendered. Endpoint failures never become zero.

Summary/history use `['credits', userId, sessionGeneration, ...]` keys. The `credits` root is excluded by the persistence allowlist; private query lifetime cancellation removes it on session boundaries. Regression tests cover late A → B → A responses and no persistence. Existing same-session memory data remains visible with a stale notice offline; cold offline shows unavailable and resumes reads on reconnect. No financial data is saved to disk.

History sends fixed `limit=10` and treats the cursor as opaque. Pull-to-refresh cancels load-more, drops later pages/cursors and refetches summary/page one. Entries are deduplicated by ledger ID. Load-more failures show an inline retry footer and retain loaded rows. Localized source labels have generic fallbacks for open keys; no backend sentences, catalogue copy, provider cost or raw source IDs are rendered. Integers use vi-VN/en-US separators; UTC dates display in local time. Reserved/available rows appear only when reserved > 0.

Focus/foreground/reconnect refresh existing read queries. Accepted AI sends and terminal reply events invalidate the same-session credits root. No changes were made to AI admission, charging or drafts.

## Verification

State tests cover Account skeleton/error/navigation, true zero/empty/contribution navigation, history initial skeleton/error, footer retry with retained rows, load more, refresh, cold/warm offline, absent/false capability, guest isolation, vi/en and Light/Dark render paths. API tests cover self routes, exact ten-item request, opaque cursor round trip, cursor reset, session cancellation and nonpersistence. These are automated local tests, not DEV or native visual acceptance.

Commands and final counts are recorded in `dev/handoffs/mobile-616-visibility-2026-11-10.md`. No git commands, simulator acceptance, deployment or remote issue updates are part of this implementation.

## Stitch request — unresolved design coverage

Live screen inventory checked in project `17315762413421369447` on 2026-11-10. Account screens exist (`d5e6daa90cd74dbb85bd938e39f10d27`, `f553e0a554d44068838136c4330e27f9`); no credit-specific screen titles were returned. This inventory does not establish credit content inside other screens or certify migration/parity. A detail request for the Account screen returned `Request contains an invalid argument`, so its visual content was not verified.

Design request for #616: approve the Account Credit GoGo row, credit history with balance/earned/spent, current assistant balance, first-load skeleton, zero/empty, initial error, stale/cold offline, loading-more and inline retry states. Include long vi/en copy, dynamic type and approved AppToken Light/Dark values. Implemented layouts reuse existing Account/Card/AppHeader/async-state primitives pending these dedicated designs. The request is prepared locally here; no Stitch design was created or approved and no issue comment was posted.

Per-turn pending/reconciling captions and exhausted composer/earning states belong to later contract slices; they still need dedicated Stitch designs when those slices are authorized. Owner simulator review remains pending for both locales/themes, navigation, pull-to-refresh, pagination and offline/error states. No claim of full Stitch migration coverage or visual parity is made.
