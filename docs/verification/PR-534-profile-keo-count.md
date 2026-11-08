# PR #534 — Profile Kèo count

Owner decision 2026-11-08, local patch on `f4e3a9f`. No commit or push.

The Kèo shortcut uses the existing `useMyRooms` / `GET /rooms` infinite-query
contract without a status filter. Users and guests can read their memberships;
anonymous sessions do not request rooms or show cached counts.

`profileKeoCount` is the single projection to replace when GoGo-BE#809 supplies
an exact total. It counts distinct room IDs across loaded pages. The last page's
`nextCursor` determines whether the count carries `+`; a complete empty list
shows `0`. It does not fetch extra pages to calculate a total. Pending queries
render the shared skeleton; errors omit the number, including stale counts,
and preserve the Kèo label and navigation. No placeholder text is rendered.

Component coverage: zero for user/guest, exact single page, multiple pages with
`+`, deduplication, final-page transition to exact, stale-data error, loading
transition to zero, and anonymous cached-data suppression. The existing saved,
review, notification, account-switch and shortcut-navigation checks remain.

Validation logs are under `/tmp/pr534-*.log`. Typecheck and lint passed with
exit 0; lint reported no warnings. The focused profile suite passed 12 tests.
`pnpm test` exited 1: 134 files passed, 1 failed, 1 skipped; 1,589 tests passed,
3 failed, 39 skipped. The three failures are in unchanged
`src/shared/config/__tests__/distribute-wrapper.test.ts:208,234,258` (process/lock
checks). A direct `ps` check is denied by this sandbox (`operation not permitted`).
No test was changed or skipped to bypass these failures.

`pnpm test:ui --runInBand` passed with exit 0: 198 suites / 2,423 tests.
The initial UI run caught three navigation assertions that expected the old
label `Kèo`; those now expect `Kèo: 0`, and the room fixture includes the
contract's `nextCursor: null`. Typecheck and lint passed again after this update.
`git diff --check` passed.

No native visual capture or DEV acceptance is claimed for this patch.
