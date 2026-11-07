# PR #516 group 03 — Nhập link → Bổ sung thông tin

Updated 2026-11-07 in `mobile-g03`, starting at clean HEAD `fe411a4`.
Owner scope: file edits and local checks only; no install, commit, push, build or deployment.
The owner’s current scoped fix supersedes the earlier migration pause for this task.

## Live Stitch evidence

Read both exact screens directly through the workspace read-only Stitch MCP
adapter (`get_screen` + `download_file`, configured connection, credentials never
printed). Inspected both downloaded HTML and screenshots. These are current
source snapshots, not app screenshots. Historical `stitch.html` / `stitch.jpg`
remain archived and are superseded by `verified.*` for this comparison.

| State | Project / screen | Live resource | Preserved evidence |
| --- | --- | --- | --- |
| Thêm địa điểm: Nhập link - GoGo | `17315762413421369447` / `a3500cc50aef4fbab76bf4587a8f6b20`, 780 × 2148 | `screens/a3500cc50aef4fbab76bf4587a8f6b20/fileEntries/html` and `/screenshot` | [HTML](PR-516-group-03-source/input.html), [PNG](PR-516-group-03-source/input.png) |
| Bổ sung thông tin (screen title: Thêm địa điểm mới - GoGo) | `17315762413421369447` / `10756253768045112131`, 780 × 2616 | HTML `files/15752337466060138129`; screenshot `files/17806848170454934078` | [HTML](PR-516-group-03-source/verified.html), [JPEG](PR-516-group-03-source/verified.jpg) |

SHA256:

- `input.html`: `e499302279e319628dd5c9ce2de1fb8f362dd8f8f103663374fc16cd5a4237fe` (16,839 bytes).
- `input.png`: `3bb14dd711c742e3810f0189e4f4e8c348aaab63ae43f597e32a679867f97d22` (257,725 bytes).
- `verified.html`: `c40a37767f55bf96112a7d7b0f67a23b5e255f4ac3e1588f112fe862fec57676` (36,718 bytes).
- `verified.jpg`: `e61bda5d7638299f04d816b807e7ac0a7839ab6a45c0659dca6c800d47f40a47` (120,684 bytes).

The new input screen contains **no existing-GoGo outcome card**. Its duplicate
prevention benefit is explanatory copy only. Per owner 2026-11-07, retain the
current canonical result card with redesign surfaces, status banner, real GoGo
photos and short administrative address. Do not invent a source result design.

## Element mapping

“Implemented” means code mapped to the source/owner requirement, not measured
pixel parity. Paths are relative to the repository root; lines identify entry points.

| Stitch element / state | App mapping / status | Files:lines |
| --- | --- | --- |
| Input header: centered Thêm địa điểm mới, back, help | Implemented: 56pt header, 44pt controls; help reveals link-taking instructions | `src/features/place-import/import.view.tsx:367`, `src/features/place-import/import.style.tsx:17` |
| Contribution banner, Dán link Google Maps, intro | Implemented: source order/copy and 26/32 bold title. New +50–70/+20 rewards deferred; banner says Cộng đồng GoGo | `src/features/place-import/import.view.tsx:402`, `src/shared/ui/tokens.ts:409`, `src/shared/i18n/vi.ts:1017` |
| White link card, Đường dẫn Google Maps, inline Dán link | Implemented: 16pt inset/radius, icon, clipboard read with error and late-response protection | `src/features/place-import/import.view.tsx:351`, `:427`, `src/features/place-import/import.style.tsx:76` |
| Empty / typing / valid / invalid | Implemented: starts empty, no seeded URL; empty CTA disabled; format badge responds while typing; invalid URL never calls BFF | `src/features/place-import/import.view.tsx:31`, `:340`, `:438`, `:463` |
| Fixed one-line input + clear x | Owner 2026-11-07: single-line native URL input, 44pt clear control, no expanding textarea | `src/features/place-import/import.view.tsx:438`, `src/features/place-import/import.style.tsx:37` |
| Keyboard never covers input | Input card registered as a focus group; focus, keyboard-show and resized viewport reveal the complete field/helper | `src/features/place-import/import.view.tsx:118`, `:389`, `:427` |
| 3 bước lấy link nhanh / Mở Google Maps | Implemented: three numbered instructions; opens real Google Maps URL | `src/features/place-import/import-guide.view.tsx:10`, `src/features/place-import/import.style.tsx:47` |
| Ưu điểm công nghệ GoGo | Implemented: extraction, duplicate prevention and existing approval-credit explanation; no wizard bonus policy | `src/features/place-import/import-guide.view.tsx:29` |
| Bottom Tiếp tục trích xuất thông tin | Implemented below input guidance; calls existing resolver, in-button spinner/disabled state uses source Đang kết nối Google Maps... | `src/features/place-import/import.view.tsx:222`, `:470` |
| Error / rate limit / provider outage | Preserved distinct server/provider messages; retry keeps entered URL and reuses resolver | `src/features/place-import/import.view.tsx:488` |
| Offline / paused network | Immediate connectivity gate prevents paid resolve from being queued while offline; paused mutation and NetworkError show offline explanation; network-error retry remains available | `src/features/place-import/import.view.tsx:110`, `:339`, `:471` |
| Input secondary footer | Existing credit policy opens a real explanation. Contribution list is visibly disabled with reason: no supported list screen/contract wired here | `src/features/place-import/import.view.tsx:473` |
| Post-verify header: Bổ sung thông tin, share, profile | Implemented: share uses actual provider/input URL; profile navigates to existing profile tab; back returns to input | `src/features/place-import/import.view.tsx:367` |
| Đã kết nối Google Maps / Hoàn thiện hồ sơ địa điểm / intro | Implemented: source badge, title and supporting copy replace input intro only after RESOLVED | `src/features/place-import/import.view.tsx:402` |
| Compact synced-link row, Đã đồng bộ, Đổi link | Implemented: actual URL/name, one-line truncation, status pill. Đổi link clears resolution, metadata, selection, local photos and submission state; focuses input | `src/features/place-import/import.view.tsx:319`, `:343`, `:414` |
| Dữ liệu đã trích xuất + synced badge | Implemented: verified icon, source heading, green status pill | `src/features/place-import/import.view.tsx:509`, `src/features/place-import/import.style.tsx:15` |
| ONE Google image, 16:10, 12pt radius, overlay badges | Existing shared preview retained and checked against current source; transient BFF photo with loading/decode/error handling, no stock/sample fallback | `src/shared/ui/place-card.view.tsx:315`, `src/shared/ui/place-card.style.tsx:6` |
| Photo attribution | Existing response Google + first photo’s own author credits; no-store request, cachePolicy=none; unusable/missing photo or attribution omitted | `src/shared/api/candidate-photo.ts:25`, `src/shared/ui/place-card.view.tsx:357` |
| Name, address, Google rating/count, actual hours | Existing verified facts retained; actual seven-day identical hours may use hàng ngày. Unknown facts/price omitted | `src/shared/ui/place-card.view.tsx:324`, `:348` |
| Bookmark for unresolved candidate | Preserved visibly disabled canonical-save control and reason; no fake draft/save endpoint | `src/features/place-import/import.view.tsx:567` |
| Existing GoGo place + short address | Preserved shared canonical PlaceCard and operational actions; administrative formatter remains authoritative | `src/features/place-import/existing-place-result.view.tsx:29`, `src/shared/ui/place-address.view.tsx:9`, `src/shared/administrative/place-address.ts:1` |
| Primary send location / optional photos 0/5 | Existing optional disclosure and photo picker remain below extracted facts; photos immediately precede existing moderation submit. Removed enclosing operational card surface so primary action sits on canvas, as in source | `src/features/place-import/import.view.tsx:698`, `src/features/place-import/import-photos.view.tsx:59`, `src/shared/ui/place-card.style.tsx:15` |
| Light input materials / Dark fallback | Input cream/dim/border/primary read from new source roles; Dark uses existing night surfaces/border and orange primary. No theme-specific content branching | `src/shared/ui/tokens.ts:505`, `:523`, `src/features/place-import/import.style.tsx:7` |

## Explicit boundaries and remaining gaps

- **GoGo-MobileApp#518, blocked on GoGo-BE#796:** do not implement the 3-step
  Giá & Mục đích / Vibe & Tiện ích / Menu-Hoá đơn-Mẹo wizard, draft workflow,
  progress, mandatory selections, or new credit numbers. Step screens `2fd3b7e3…`
  and `3d9ed7f6…` are downstream references, not targets of this patch. Existing
  optional metadata and existing moderation-submit contract remain unchanged.
- Source +50–70 banner / +20 bill-menu rewards are omitted under that owner scope.
  Existing +50 approval-only wording is retained; no new reward calculation.
- Source contribution-list button has no supported destination here. It is
  disabled and explained, rather than using the source’s demo toast as behavior.
  No remote issue/comment was created under the file-edit-only authorization.
- Photo selection remains optional 0–5. The inherited attachment capability is
  local preview only (GoGo-BE#793): local URIs are never uploaded or sent to the
  moderation API. The visible local-only explanation remains. This patch does
  not claim persistent attachment delivery.
- Candidate bookmark stays unavailable until there is a canonical GoGo ID.
  Missing provider imagery/facts are omitted; unknown price is hidden. No café,
  sample URL, score, schedule, uploaded menu or bill from Stitch is app data.
  Archived design evidence is documentation only.
- Source input copy includes “trong 3 giây”; it is copied as requested, not a
  measured backend latency guarantee. No artificial 3-second delay or demo
  success timer is implemented. The existing approval flow does not add the
  source’s unverified 24-hour moderation promise.
- **FAIL parity (no Stitch Dark)**: both add-place sources have no Dark design
  per owner 2026-11-07. Dark is implemented with existing night tokens; it cannot
  be certified as Stitch Dark parity.
- Light app/Stitch screenshot comparison: **BLOCKED / not measured**. This
  edit-only task ran no simulator/build or screenshot capture. Source inspection
  and component assertions do not establish 100% visual acceptance.

## Verification

- `pnpm typecheck`: PASS.
- `pnpm lint`: PASS.
- `pnpm test:ui --runInBand` with five place-import suites, shared place-card,
  shared place-address UI and administrative place-address: **PASS, 8 suites,
  211 tests**.
- `pnpm test src/shared/api/__tests__/view-models.test.ts src/shared/ui/__tests__/theme-dark.test.ts`:
  **PASS, 2 suites, 71 tests**.
- `git diff --check`: PASS.
- No contract/schema change or new endpoint. Existing resolver/submission
  telemetry retained; URLs and opaque resolution proofs stay out of analytics.
- Regression checks include valid/invalid/empty input, clipboard denied/empty/
  stale, verifying, offline/reconnect/paused/NetworkError, retry, header actions,
  change-link reset, stale resolution A→B→A, future opening, provider outage,
  polling, first-photo attribution/no cache, late photo/picker cancellation,
  optional photo limits, missing facts and short-form addresses.
- Full repository suites, CI, independent review, device keyboard checks and
  owner acceptance were not run/claimed. HEAD remains `fe411a4`; only working
  files changed. No install, commit or push.
