# NTF-APP-010 — one notification switch

Refs #215. Consumes GoGo-BE#572 (PR #582, contract `1.0.0-alpha.32`, ADR-0025); the vendored `openapi/gogo.v1.yaml` is byte-identical to that PR's head.

Notification settings show one account switch instead of twelve per-kind toggles. The switch reads and writes `/me/notification-settings`, moves optimistically, rolls back on a failed save and offers a retry of the same choice. It is disabled while loading or saving, so a double tap sends one request. A device card beside it reports this phone's OS permission (checking / allowed / off in Settings with an Open Settings action / unreadable with retry) and refreshes on return from Settings; it never implies that anything was delivered. An off carried over from older per-kind choices (`migrated`/`legacy`) says why. The switch writes nothing but the preference: no push subscription call, no inbox change. The query lives under `me`, which sign-in and sign-out purge.

The account switch is deliberately not locked behind this device's OS permission: it applies to every device of the account.

Validation: command output against the exact head is in the pull request. Jest worker force-exit: this change's hook spec (`notification-settings-hook.spec.tsx`) built its QueryClient with the default 5-minute `gcTime`. Unmounting a mutation observer schedules a garbage-collection timeout that `client.clear()` does not cancel, so the Jest process stayed alive after the suite (run alone in band: still running after 180 s). The spec now uses an infinite `gcTime` (run alone in band: exits after 4 s). Full runs still print the warning because two suites inherited from develop, `optimistic-rollback.spec.tsx` and `room-invite.spec.tsx`, keep the same timer; with only those two patched locally and not committed, the full run on this branch prints no warning. That develop leak belongs to Mobile #133 and is not fixed here.

Not run: Android/iOS devices, DEV deploy, real push delivery.
