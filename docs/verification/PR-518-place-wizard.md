# #518 — CMS-driven place contribution wizard

Refs #518. Worktree `mobile-518`, baseline HEAD `db68229` (clean at start).
Owner's 2026-11-07 instruction authorizes this focused file/test change and
supersedes the earlier Stitch-only option mapping for this wizard. It does not
establish completion of the project-wide Stitch migration gate.
No install, commit, push, backend modification, native build, or Stitch write.

## Current behavior

Options come exclusively from `GET /v1/taxonomies`:

| Wizard group | Taxonomy kind | Selection limit |
| --- | --- | --- |
| Mục đích | suitability | 10 |
| Vibe | mood | 3 |
| Tiện ích | amenity | 6 (current BE#796 maximum properties) |
| Đánh giá chips | checkin_tag | 5 per rating |

There are no client-owned option allowlists. Entries sort by `sortOrder`, with
response order preserved for ties. The public endpoint returns active entries;
an explicit `active: false`, if supplied, is also excluded. Labels prefer the
exact API locale, then the language subtag. Existing i18n copy is a fallback
only when that locale has no API label; new keys without local copy can use the
API Vietnamese label, then the key as a last-resort missing-label indicator.
Unknown amenity keys render with the generic `activity` icon.

Collapsed groups show six chips or five amenity checklist rows. Selected values
replace unselected preview entries, preserving CMS order. If more values are
selected than the preview limit, all selections remain visible, as required.
The dashed `+N khác` chip counts hidden entries; amenities use
`Xem tất cả N tiện ích`. Both open the existing shared animated Sheet, with
search, selected count / limit, checkbox rows, and primary `Xong`. Optional
string `group` metadata is displayed when supplied; the current endpoint has
no group metadata, so no client categories are invented. Search and the list
stay inside the shared sheet's keyboard/accessibility/motion behavior.
All surfaces use shared theme tokens for Light and Dark.

Loading, fetch failure/retry, empty groups, and search with no matches have
explicit states. Missing required suitability/mood data prevents completion.
Both submission and draft writes reject keys absent from the fetched kind,
duplicates, and over-limit selections. Retired rating tags are no longer
silently dropped: users must explicitly clear unavailable draft selections.
Amenities remain omitted when unknown, including when a true selection is
unchecked; explicit false values from an old draft survive unrelated changes.
The optional shared star control retains the existing service/space payload
shape. Rating chips apply to both ratings and become selectable after rating.
Step 3 remains optional. Draft version/conflict handling and photo blocking
are unchanged.

## Live read-only evidence — 2026-11-07

Read `https://api-dev.gogo.id.vn/v1/taxonomies` directly with GET. It returned
5 suitability, 10 mood, 7 amenity, and 9 checkin_tag entries, including:

- mood: quiet_private, acoustic_music, airy_garden, cool_indoor, rooftop_view;
- suitability: photo_spot;
- checkin_tag: friendly_staff, fast_service, pleasant_music.

Called the configured Stitch MCP `list_screens` for project
`17315762413421369447`: 79 screens returned, none with the title
`Thêm địa điểm: Bước 2 · Nhiều lựa chọn - GoGo` (nor any title containing
`Nhiều`). Implemented the owner's supplied overflow-sheet specification.
No new-screen pixel parity or device acceptance is claimed.

Previously inspected source screens remain reference context:

| Step | Screen |
| --- | --- |
| 1 | 10756253768045112131 |
| 2 | 2fd3b7e365954d6db9ef612d361a1bbf |
| 3 | 3d9ed7f6136a477c85c76057aafff0b4 |

Existing HTML/images are in `PR-516-group-03-source` and `PR-518-source`.
The old fixed mapping, substituted Stitch labels, and statements that the new
CMS keys do not exist are superseded by this change and live API read.

## Backend contract blocker — not server acceptance

The vendored `openapi/gogo.v1.yaml` and the read-only local `be-796` worktree
still describe **six named amenities only**, `additionalProperties: false`,
and service_/space_ prefixes for checkin_tag keys. Its implementation at
`libs/modules/ingestion/application/contribution-enrichment.ts` still enforces
that list and those prefixes. This conflicts with the owner's CMS-driven
requirement and the live API values (e.g. wifi, friendly_staff).

This patch renders the real API values and preserves their exact keys; it does
not invent prefixed aliases, silently discard claims, or modify the backend
contract to claim support that does not exist. Client checks enforce fetched
membership and BE cardinalities (10 purposes, 3 vibes, 6 amenities, 5 tags).
**New amenities and shared unprefixed rating tags still require a BE#796
contract/validator update before end-to-end acceptance.** The current client
will send those exact selected keys; the old backend validator rejects them.
A newer backend contract was requested during implementation; none was supplied.

`openapi/gogo.v1.yaml` was originally vendored from the local `be-796` worktree.
Its recorded SHA256 remains
`c9ea74f45097bdb0aeff95efb51a1a45baa8e92d581c38645be27358e5c865d2`.
Re-vendor the merged backend contract, regenerate `schema.d.ts`, run
`pnpm api:check`, and verify real selected CMS keys against the updated server.
The older required-service/space schema also predates the owner's optional-step-3
instruction and needs reconciliation there. No submission POST was made.

## Verification

- `pnpm typecheck`: PASS.
- `pnpm lint`: PASS, no diagnostics.
- `pnpm test`: **114 suites passed, 1 failed, 1 skipped; 1,328 tests passed,
  3 failed, 39 skipped**. All failures are the pre-existing distribution-wrapper
  process-inspection cases at lines 208/234/258. `ps` returns operation not
  permitted in this sandbox, matching the prior verification on this branch.
  No unrelated scripts/assertions/skips or permissions were changed to hide it.
- `pnpm test:ui --runInBand`: **182 suites / 2,163 tests PASS** before the last
  three additional wizard regressions and explicit-false preservation adjustment.
- Final affected UI rerun (wizard, owner import, resolution token, future opening):
  **4 suites / 81 tests PASS**, including all **23 wizard tests**.
- Final focused form/options/draft API: **3 suites / 17 tests PASS**.
- `git diff --check`: PASS.

New regression coverage: 40 moods, all three chip groups exceeding six options,
CMS sorting, API locale labels and i18n fallback, selected overflow visibility,
search/no matches, optional groups, max-three moods, max-five rating tags,
amenity overflow checklist, generic unknown-key icon, and explicit stale-key
clearing before writes.

Remaining acceptance: the backend contract conflict above; full Vitest process
inspection outside this restricted sandbox; device Light/Dark, keyboard,
VoiceOver and large-text review against the new Stitch screen when available.
