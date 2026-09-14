# PROF-APP-006 — date of birth in account information

Refs #217. Vendors `openapi/gogo.v1.yaml` byte-identical to GoGo-BE PR #586 head `da06b9a` (1.0.0-alpha.32). Merge BE #586 first. If BE rebases onto a later alpha, re-vendor before merging this.

Account information has an optional date of birth below the display name. It is typed as day/month/year, the app's existing date input pattern. No picker library is installed, and a native one would need an ADR. The field has a label, a format hint, errors in a live region and 44pt targets.

- A saved date shows in the reader's language, for example `17 tháng 5, 1990`. It is formatted in UTC from its own calendar parts and never passes through `new Date(iso)`, so no device time zone moves the day.
- Save refuses a date that does not exist, such as 29/02/2027, and a date after today in Asia/Ho_Chi_Minh, before any request. That zone is a fixed UTC+7 with no daylight saving, so it needs no engine time-zone data. A server `too_big` or `invalid_date` field error shows the same messages.
- Clear sends `null`. An old account without the field reads as unset.
- Save shows the new date at once. A failed save restores the previous profile in the cache, keeps the typed text and says so.
- The card is keyed by account id. A late answer for a previous account never writes into the next account's cached profile.
- Analytics record that a date was set or cleared, never the date. The vendored contract carries the field only on `Me` and `ProfilePatch`.

Validation:

| Check | Result |
| --- | --- |
| typecheck, lint, api:check | pass |
| vitest | 286 passed, 39 skipped, in 38 files; 5 new |
| jest, full run without `--forceExit` | 168 passed in 29 suites; 8 new |
| jest process | exited by itself, code 0 |

The jest cases cover a leap day, a nonexistent leap day, tomorrow in Hanoi, a server refusal, clearing, a failed save with rollback, an old account, and a second sign-in with a late answer from the first account. No native dependency was added. BE deployment and device acceptance, including keyboard and screen reader, are pending.

Rollback: revert this consumer. The field is optional in the contract.
