# PR #516 group 03 — source-backed partial fix, 2026-11-07

## Direct Stitch evidence

Read **the exact requested screen** using the workspace read-only Stitch MCP
adapter (`get_screen`, then `download_file`). Authentication used the configured
Stitch connection without printing credentials. Both downloads succeeded.

- Project: `17315762413421369447`.
- Screen: `10756253768045112131`, title `Thêm địa điểm mới - GoGo`, 780 × 2616.
- HTML resource: `projects/17315762413421369447/files/2126213299152914023`.
- Screenshot resource: `projects/17315762413421369447/files/8666062041805651013`.
- Preserved [HTML](PR-516-group-03-source/stitch.html) (34,554 bytes;
  SHA256 `28a1e97008436ab71453cdef2cb45c32b89ff248186a08ea007eb9722414397f`).
- Preserved [Stitch screenshot](PR-516-group-03-source/stitch.jpg) (123,346 bytes;
  SHA256 `76a2a9eec4e3cf90976181539797c601a54c5539b761cb815ba79074141e687c`).

**The current source is a different state from the request.** Its visible header
is “Bổ sung thông tin”, intro “Hoàn thiện hồ sơ địa điểm”, followed by a compact
synced-link row (“Đã đồng bộ” / “Đổi link”) and “Dữ liệu đã trích xuất”.
There is **no editable link field, Dán link, Xác minh địa điểm or existing-GoGo
result** in this downloaded HTML/screenshot. JavaScript still references removed
input IDs; those handlers do not supply a visual specification. Project screen
inventory was also read: this is the only add-place screen, and no corresponding
Dark add-place screen is listed. The other import screen is “Trạng thái nhập địa
điểm - GoGo” (`11596318734062514103`).

Clarification was requested about these source differences. Until resolved,
retain the explicitly requested input/existing states and adapt the extracted
result to the source that is actually available. Do not interpret that assumption
as an owner decision approving discrepancies. **100% parity is not achieved.**

## Element mapping

“Changed” identifies implementation work against source or explicit owner scope;
it does not certify screenshot parity. “Pending” flags missing design evidence.
Paths below are relative to the repository root.

| Stitch element / requested state | App element and status | Files:lines / reason |
| --- | --- | --- |
| 16px page gutter; surface background | Changed: redesign canvas, 16px horizontal inset | `src/features/place-import/import.view.tsx:328`, `:354` |
| Compact synced-link row / Đổi link | Pending: current source has this instead of the requested input card; editable input retained | `src/features/place-import/import.view.tsx:363`; source-state decision required |
| Requested Liên kết Google Maps / field / Dán link | Changed: 12px card inset/radius, redesign surfaces, spaced one-line input; clipboard preserved. Pending exact input-state source | `src/features/place-import/import.view.tsx:363`, `src/features/place-import/import.style.tsx:37` |
| Requested clear (x), keyboard visibility | Match to owner 2026-11-07: single line, 44pt clear control, focus/keyboard scrolling preserved | `src/features/place-import/import.view.tsx:339`, `:366`, `:397`; regression tests |
| Requested Xác minh địa điểm / loading | Changed: shared pill button; spinner and busy/disabled state stay inside the button rather than replacing it with a separate row. Pending exact source | `src/features/place-import/import.view.tsx:425` |
| Dữ liệu đã trích xuất + verified icon + synced pill | Changed: source copy, 17/22 heading, 24px top gap / 8px bottom gap, semantic light/dark colors | `src/features/place-import/import.view.tsx:457`, `src/features/place-import/import.style.tsx:8` |
| 16:10 image, 12px card radius | Changed: ONE transient Google image at top of result card | `src/shared/ui/place-card.view.tsx:334`, `src/shared/ui/place-card.style.tsx:6` |
| Photo loading | Changed: skeleton in the same 16:10 photo slot, submit remains available | `src/shared/ui/place-card.view.tsx:335` |
| Photo absent/error/decode failure | Hidden-with-reason: no usable BFF image; no sample/stock image or empty image slot. Badge/save remain accessible above facts | `src/shared/ui/place-card.view.tsx:318`, `:347`, `src/shared/api/candidate-photo.ts:25` |
| Google/author image attribution | Changed: response Google attribution plus first image's own author credits; no-store transient bytes / `cachePolicy=none` | `src/shared/api/candidate-photo.ts:43`, `src/shared/ui/place-card.view.tsx:357` |
| ✓ Dữ liệu Google Maps xác thực | Changed: source wording and check-circle badge over photo, inset 12px | `src/shared/ui/place-card.view.tsx:342`, `src/shared/ui/place-card.style.tsx:10` |
| Bookmark at photo top right | Changed: moved candidate Lưu to 44pt icon control; visibly unavailable and explained because candidate has no canonical ID | `src/features/place-import/import.view.tsx:515`, `:535`; candidate-save API gap |
| Opening-status overlay bottom right | Changed: actual derived state, never source sample time | `src/shared/ui/place-card.view.tsx:319`, `:344` |
| Name / location icon / address | Changed: 22/28 semibold title, 15/20 address, 16px body inset | `src/shared/ui/place-card.view.tsx:348`, `src/shared/ui/place-card.style.tsx:7` |
| Rating / count / Google chip | Changed: localized actual score/count with explicit Google source | `src/shared/ui/place-card.view.tsx:354`; missing score hidden-with-reason |
| Weekly-hours chip | Changed: actual provider hours; “hàng ngày” only when all seven days have identical intervals; otherwise shows individual days | `src/shared/ui/place-card.view.tsx:324`, `:355`; unknown hours hidden-with-reason |
| Requested category (not in current screenshot) | Retained from owner 2026-11-07 scope; taxonomy label only when real key resolves | `src/features/place-import/import.view.tsx:517`, `src/shared/ui/place-card.view.tsx:352` |
| Unknown price / café example data | Hidden-with-reason: no verified amount and unit; owner 2026-11-06. No Stitch sample name, address, photos, rating, hours or selections shipped as app data | `src/shared/ui/place-card.view.tsx:348` |
| Separate operational zone below card | Changed: actions/optional information moved out of the extracted facts card, 24px separation | `src/shared/ui/place-card.view.tsx:361`, `src/shared/ui/place-card.style.tsx:15` |
| Requested credit note / Google Maps external link | Retained: +50 only after approval, canonical provider URL only; absent URL hidden-with-reason | `src/features/place-import/import.view.tsx:535` |
| Requested Bổ sung thông tin | Retained functioning optional metadata disclosure; source's different accordion workflow remains pending | `src/features/place-import/import.view.tsx:547` |
| Source dashed photo-upload control / requested Thêm ảnh 0/5 | Changed: dashed picker, visible count, optional 0–5 selection and removal; local-only limitation stays visible | `src/features/place-import/import-photos.view.tsx:59`; attachment API missing, BE#793 |
| Existing-GoGo state (absent from source) | Changed: status banner and shared redesign PlaceCard; pending exact source-state design. Uses GoGo photos, no candidate Google request | `src/features/place-import/existing-place-result.view.tsx:29`, `:39` |
| Short GoGo address | Match to owner requirement: shared PlaceCard → FormattedPlaceAddress → administrative formatter retained | `src/shared/ui/place-card.view.tsx:177`, `src/shared/ui/place-address.view.tsx:9` |
| Light + Dark | Changed together through semantic redesign tokens, including source green synced badge and photo-badge ink; no theme-specific content branches | `src/shared/ui/tokens.ts:503`, `:520`, `src/shared/ui/text.tsx:65`; visual comparison pending |

## Source features not implemented / capability gaps

- Input-state visual design and existing-GoGo state: not present in the exact
  downloaded source. Required before claiming complete parity for either state.
- Source's new “Mức giá & Mục đích”, “Không gian & Tiện ích” and
  “Ảnh Menu, Hoá đơn & Mẹo hay” accordion workflow: differs from the explicitly
  scoped existing optional metadata flow. No new required price, purposes,
  amenities, receipt processing or draft workflow was invented.
- Sample progress “2/3”, “Nhận tối đa +70 Credit”, extra +20 rewards and
  completed selections are not real app data or approved reward policy.
- Automatic receipt PII redaction, persistent attachments: no mobile attachment
  flow in the public submission contract; existing gap GoGo-BE#793.
- Lưu nháp / saving an unresolved candidate: no supported canonical-save ID or
  draft contract. Candidate bookmark is unavailable with its reason.
- The source's 24-hour moderation promise is not a verified API guarantee;
  retained existing approval-only credit wording instead.
- No backend issue/comment was created: this task authorizes file edits only.

## Contract provenance

The previous continuation's contract/photo work was preserved. Verified again
that `openapi/gogo.v1.yaml` matches byte-for-byte the locally available BE
`origin/re-design` at `1ee75444414e1c9efc2948a9fb4c1a8e2661d8ee`,
version `7.0.0-alpha.1`. Types use installed `openapi-typescript` 7.13.0;
`api:check` uses that same generator and vendored file. No CMS endpoint calls
were added. Existing GoGo photos do not use `getCandidateProviderPhoto`.

## Verification

Current continuation:

- `pnpm api:check`: PASS.
- `pnpm typecheck`: PASS.
- `pnpm lint`: PASS.
- Six focused UI suites: PASS, 57 tests. Includes owner/photo, status,
  stale-resolution, provider outage, future-opening and rating-refresh tests.
- `pnpm test src/shared/api/__tests__/view-models.test.ts`: PASS, 43 tests.
- `git diff --check`: PASS.
- Added regressions: stable in-button verification loading; source photo/card
  dimensions; actual daily hours and Google rating source; unavailable save
  control with reason; no sample café data. Existing photo failure, attribution,
  one-photo, cancellation, optional-upload, keyboard and no-extra-Google-request
  tests remain passing.
- Full suites were not rerun in this continuation. Previous run recorded three
  failures in `src/shared/config/__tests__/distribute-wrapper.test.ts`; its
  excluded-suite run passed 111 suites / 1,288 tests (39 skipped). These are
  prior-run observations, not current full-suite proof.
- App/Stitch Light+Dark screenshot comparisons: **0/1 pairs**. No simulator
  mutation/build was performed under the edit-only authorization. No 100%
  Stitch acceptance, CI completion or owner acceptance is claimed.

Only files edited. No install, commit or push.
