# NTF-APP-010 — one notification switch

Refs #215. Consumes GoGo-BE#572 (PR #582, contract `1.0.0-alpha.32`, ADR-0025); the vendored `openapi/gogo.v1.yaml` is byte-identical to that PR's head.

Notification settings show one account switch instead of twelve per-kind toggles. The switch reads and writes `/me/notification-settings`, moves optimistically, rolls back on a failed save and offers a retry of the same choice. It is disabled while loading or saving, so a double tap sends one request. A device card beside it reports this phone's OS permission (checking / allowed / off in Settings with an Open Settings action / unreadable with retry) and refreshes on return from Settings; it never implies that anything was delivered. An off carried over from older per-kind choices (`migrated`/`legacy`) says why. The switch writes nothing but the preference: no push subscription call, no inbox change. The query lives under `me`, which sign-in and sign-out purge.

The account switch is deliberately not locked behind this device's OS permission: it applies to every device of the account.

Validation: `api:check`, `tsc --noEmit`, `expo lint` pass; vitest 281 passed / 39 skipped; jest 29 suites / 165 tests passed; the jest process exited rc 0 without the watchdog, but jest reported one worker it force-exited after the run (Mobile #133 leak class). Includes 11 screen tests and 3 hook tests (optimistic move, rollback leaving the inbox untouched, stored answer, purge prefix).

Not run: Android/iOS devices, DEV deploy, real push delivery.
