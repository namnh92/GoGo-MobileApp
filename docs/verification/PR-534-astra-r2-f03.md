# PR #534 — Astra r2 F-03

Date: 2026-11-08. Worktree: `dev/worktrees/mobile-533`. Started clean at `d5ee320`; changes are uncommitted. No push.

## Behavior

- A successful submission DETAIL without place facts shows a non-retry availability note in Vietnamese and English. Provider outcomes never create a Retry button.
- A missing/blank DETAIL name or address cannot erase real list-row facts. A missing provider snapshot cannot erase the list-row Maps link. The validated Maps hostname identifies an available link without displaying its query, credentials, fragment or tracking parameters.
- The original submitted date, moderation/status badges and rejected-row reason/supplement flow remain visible.
- Automatic and manual DETAIL retries share the same policy: network/timeout or HTTP 5xx only. Automatic retry is bounded to one; 4xx, including 429 and retryable envelopes, get no retry.
- Budget-exhausted/deferred DETAIL results stay fresh in the existing private five-minute memory cache, including across renders and filter remounts after the ordinary one-minute freshness interval. A changed `updatedAt` gets a new key. No disk persistence, polling, focus or reconnect refresh was added.

## Remaining data limitation

The current LIST/DETAIL OpenAPI contract has no original submitted-link field. The only Maps URL on these responses is `providerDisplay.googleMapsUri`, which is absent when neither response has a snapshot. `MySubmissionContribution` also contains no link. A provider URI is not necessarily the original submitted URL.

When an actual safe URI exists on either response, the fallback label uses its hostname. With no URI and no real name, the card uses localized structural copy, “Liên kết Google Maps đã gửi” / “Submitted Google Maps link”, alongside the real submitted date and status. It does not invent place facts or a URL. The requested label derived from the original submitted link remains blocked on an authorized data source; this patch does not change or pretend to extend the BFF contract.

## Regression proof

- Before production changes: hydration regression suite failed, **18 failed / 10 passed** (`/tmp/mobile-534-f03-before.log`).
- Final focused hydration and adjacent contribution suites: **2 suites / 38 passed** (`/tmp/mobile-534-f03-after-final.log`). Covers all declared provider outcomes with no snapshot, pending/rejected states, real identity preservation, safe/unsafe URI fallbacks, both locales, cache reuse/new submission versions, offline-to-online, bounded transient retries and manual recovery, non-transient failures, and private-cache policy.
- Adjacent contribution tests passed with the initial hydration patch: **2 suites / 35 tests** (`/tmp/mobile-534-f03-after.log`).
- Final transport/retry-policy suite: **17 passed** (`/tmp/mobile-534-f03-transport.log`).

## Checks

- `pnpm typecheck`: exit 0 (`/tmp/mobile-534-f03-typecheck-final.log`).
- `pnpm lint`: exit 0 (`/tmp/mobile-534-f03-lint-final.log`).
- `pnpm test`: exit 1; **134 suites passed / 1 failed / 1 skipped; 1,589 tests passed / 3 failed / 39 skipped** (`/tmp/mobile-534-f03-test-final.log`). The three failures are unchanged process-lock checks at `src/shared/config/__tests__/distribute-wrapper.test.ts:208,234,258`. Direct `/bin/ps` inspection returns “operation not permitted” in this sandbox. Neither the tests nor `scripts/distribute.sh` were changed. The retry-policy cases are also included in the final full unit run.
- `pnpm test:ui --runInBand`: exit 0; **198 suites / 2,419 tests passed** (`/tmp/mobile-534-f03-ui-final.log`).
- `git diff --check`: exit 0.

These are local automated checks; no deployed-backend, simulator or visual acceptance is claimed.
