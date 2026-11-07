# PR #516 group 03 — Nhập link → Bổ sung thông tin

Updated 2026-11-07 in `mobile-g03`, latest owner fix starting at clean HEAD `fd40f3d`.
Owner scope: file edits and local checks only; no install, commit, push, build or deployment.
The owner’s current scoped fix supersedes the earlier migration pause for this task.

## Current owner fix — duplicate hours and long photo credit (fd40f3d + working edits)

Owner simulator feedback on Kem Tràng Tiền, 2026-11-07, supersedes the
historical bottom-left wrapping credit / photo-hours treatment below.

- Shared `PlaceCard` preview variant now shows opening facts once, in one body
  chip: a semantic green/red state dot plus localized state text and API hours.
  Open example: **● Đang mở · 08:00–23:00 hàng ngày**. Closed example:
  **● Đã đóng · Mở 08:00**; next-day/later openings keep their day qualifier.
  Seven identical API day schedules retain the daily shorthand; other schedules
  retain weekday labels. Missing hours produce no invented state or schedule.
- Removed the photo-hours overlay. The photo credit is alone at top-left,
  12pt from the top/left. Its container ends 60pt from the right edge, reserving
  the Maps action's 44pt target, 8pt right inset and 8pt gap. The credit has
  `maxWidth: 100%` inside that reserved slot, one line and tail ellipsis; its
  accessibility label contains the complete authors/provider text. Existing
  author links and the top-right Maps action remain functional.
- The same preview component renders extracted and supplement stages; no
  screen-specific copy was introduced. Photo failures still remove credit.
- API contract, photo fetch/no-cache behavior and canonical GoGo cards unchanged.

Verification in this run:

- `pnpm typecheck`: **PASS**.
- `pnpm lint`: **PASS**, zero warnings.
- `pnpm test:ui --runInBand src/features/__tests__/place-import*.spec.tsx src/shared/ui/__tests__/place-card.spec.tsx`:
  **PASS, 6 suites, 144 tests** (58 owner tests).
- Regression proof: single body hours with no hours anywhere in photo, open,
  closed and next-day states at fixed Vietnam times, both import stages,
  unknown-hours omission, long-name single-line ellipsis/full accessible credit,
  reserved Maps gap, Light/Dark scrims, profile links and image-error removal.
- `pnpm test`: **FAIL, 111 files passed, 1 failed, 1 skipped; 1311 tests
  passed, 3 failed, 39 skipped**. The only failures are the previously documented
  process-liveness cases in unchanged `src/shared/config/__tests__/distribute-wrapper.test.ts`
  at lines 208, 234 and 258. Confirmed again: `/bin/ps -o lstart= -p $$`
  returns `operation not permitted` under this managed sandbox. A green full
  unit gate requires process-inspection access; no tests or distribution logic
  were changed or skipped to conceal the failures.
- `git diff --check`: **PASS**.
- File edits/checks only. No install, commit, push, build, deployment or simulator
  run. Structural bounds and text props do not establish native visual acceptance.

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
| Input secondary footer | Owner 2026-11-07: removed credit-policy link; contributions link and unavailable message hidden until #518 provides a route | `src/features/place-import/import.view.tsx:473` |
| Post-verify header: Bổ sung thông tin, notification bell | Owner 2026-11-07: removed share/avatar; shared Home/Search notification bell on both import stages, unread dot and inbox navigation; back returns to input | `src/features/place-import/import.view.tsx:367` |
| Đã kết nối Google Maps / Hoàn thiện hồ sơ địa điểm / intro | Owner 2026-11-07: removed connected chip; title and supporting copy remain after RESOLVED | `src/features/place-import/import.view.tsx:402` |
| Compact synced-link row, Đã đồng bộ, Đổi link | Implemented: actual URL/name, one-line truncation, one checked status pill (the only verification confirmation). Đổi link clears resolution, metadata, selection, local photos and submission state; focuses input | `src/features/place-import/import.view.tsx:319`, `:343`, `:414` |
| Dữ liệu đã trích xuất + synced badge | Owner 2026-11-07: plain section heading; removed verified icon and synced pill | `src/features/place-import/import.view.tsx:509`, `src/features/place-import/import.style.tsx:15` |
| ONE Google image, 16:10, 12pt radius, hours/save overlays | Existing shared preview retained and checked against current source; transient BFF photo with loading/decode/error handling, no stock/sample fallback | `src/shared/ui/place-card.view.tsx:315`, `src/shared/ui/place-card.style.tsx:6` |
| Photo attribution | Owner 2026-11-07: localized Ảnh: <authors> · Google Maps pill alone at photo top-left, single-line/tail ellipsis with full accessible text and reserved Maps gap; response author URI remains linkable; no below-photo credit line. Repeated provider credit omitted, distinct credits retained. No-store/cachePolicy=none unchanged | `src/shared/api/candidate-photo.ts:25`, `src/shared/ui/place-card.view.tsx:345` |
| Name, address, Google rating/count, actual hours | Existing verified facts retained; actual seven-day identical hours may use hàng ngày. Unknown facts/price omitted | `src/shared/ui/place-card.view.tsx:324`, `:348` |
| Candidate Maps / save actions | Owner 2026-11-07: Maps icon inside extracted card, 44×44 touch target; candidate bookmark and save-lock explanation absent. Existing GoGo place saving retained | `src/features/place-import/import.view.tsx:559`, `src/shared/ui/place-card.view.tsx:343` |
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
  The input-stage credit-policy footer link is removed per latest owner feedback. On Bổ sung thông tin, #516
  renders no +50 reward copy; the single header pill belongs to #518 and is
  absent from this branch. No new reward calculation or duplicate pill is added.
- Source contribution-list button has no supported destination here. Per owner
  2026-11-07, hide the link and unavailable message until #518 wires the screen.
  No remote issue/comment was created under the file-edit-only authorization.
- Photo selection remains optional 0–5. The inherited attachment capability is
  local preview only (GoGo-BE#793): local URIs are never uploaded or sent to the
  moderation API. The visible local-only explanation remains. This patch does
  not claim persistent attachment delivery.
- Candidate bookmark and save-lock explanation are absent until there is a canonical GoGo ID.
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

## Owner-dated deviations from Stitch — 2026-11-07

Owner feedback on the Kem Tràng Tiền simulator screenshot supersedes the repeated
verification decorations in the Stitch source:

- Removed the header share button and replaced the avatar with the shared
  Home/Search `HeaderNotificationButton`, following the 2026-11-05 bell decision.
  Both **Nhập link** and **Bổ sung thông tin** use its unread dot and real
  `/notifications` navigation; input-stage help remains available.
- Removed the intro/header chip **Đã kết nối Google Maps**.
- Removed the section pill **✓ Đã đồng bộ từ Google Maps** and its separate
  verified heading icon.
- Removed the photo-overlay **Dữ liệu Google Maps xác thực** badge, including
  both its icon tick and literal ✓; also removed its no-photo inline fallback.
- Kept only the synced-link row **Đã đồng bộ / Đã xác minh vị trí** context,
  with exactly one check-circle icon and no literal ✓. This ties confirmation
  to the actual submitted link and preserves Đổi link.
- Combined photo credit into **Ảnh: <authors> · Google Maps** (English: Photo:),
  retaining every first-photo author and HTTP(S) author profile link supplied by
  the response (protocol-relative Google profile links normalize to HTTPS). Omitted the duplicate candidate Google Maps credit while
  retaining distinct required attribution text.
- Input stays 52pt high, single-line with horizontal scrolling, explicit width
  constraints and reserved space for the 44pt clear-x control. Regression covers
  pasting a long URL from the clipboard and clearing the full value.

Latest simulator feedback for a place **not yet on GoGo** (owner 2026-11-07,
starting HEAD `8d40125`) supersedes the source bookmark and reward repetition:

- Removed the text button **Mở trên Google Maps** below the extracted card.
  Its replacement is a 44×44 map icon button on the card, at the top-right of
  the photo or right-aligned inside the card when no photo is available.
  Accessibility label remains **Mở trên Google Maps**; it opens the same
  candidate `googleMapsUri` and retains the link-failure message. No URI means
  no Maps action.
- Removed the candidate bookmark entirely, including its disabled state and
  **Chỉ lưu được sau khi…** explanation. Existing canonical GoGo results keep
  their working save control.
- Removed **+50 credit GoGo AI sau khi đóng góp của bạn được duyệt.** from
  the extracted-data actions. The only intended reward message on this screen
  is the wizard header pill owned by #518; that wizard is absent from this
  branch and is not implemented here. Input-stage link-taking help remains; the latest owner feedback below removes
  its credit-policy footer link.
- Renamed the preview-only `saveAction` slot to `headerAction` to describe the
  Maps action; canonical PlaceCard saving is unchanged.

Photo-credit requirements checked against [Google Places photo guidance](https://developers.google.com/maps/documentation/places/web-service/place-photos):
retain photo authors alongside the image and provider attribution.

Historical simulator feedback (owner **2026-11-07**, starting clean HEAD `fcf3059`)
supersedes the earlier below-photo credit and disabled footer treatment:

- Moved **Ảnh: <authors> · Google Maps** into a small rounded pill on the
  photo, bottom-left opposite the hours pill. White caption text uses the
  design-system `redesign.scrimStart` background in Light and Dark. Both pills
  share a bounded wrapping row, allowing longer author names without overlap;
  author profile links and full attribution remain available. Removed the
  credit from the card body; no photo-credit line remains below the photo/card.
  Failed or unavailable images have no photo-credit pill.
- Removed **Cách tính điểm GoGo Credit** from the Nhập link footer. No
  contributions route exists under `src/app` in this branch, so also hid
  **Xem địa điểm đã đóng góp** and **Danh sách đóng góp chưa khả dụng.**
  #518 owns the contributions screen and future link wiring. Link-taking help
  and the existing explanatory benefits remain.

## Historical verification — owner fix at fcf3059 + working edits

- `pnpm typecheck`: **PASS**.
- `pnpm lint`: **PASS**, zero warnings.
- `pnpm test:ui --runInBand` for the five place-import suites plus shared
  place-card: **PASS, 6 suites, 140 tests**.
- Regression covers photo-frame ancestry, one localized credit, link handoff
  for HTTPS/protocol-relative author URIs, bounded wrapping pills, Light/Dark
  scrim roles, long author text without truncation, credit removal on photo
  decode failure, hidden footer links/message, and preserved link-taking help.
- `pnpm test`: **FAIL, 111 files passed, 1 failed, 1 skipped; 1311 tests
  passed, 3 failed, 39 skipped**. The failures are unchanged process-liveness
  cases in `src/shared/config/__tests__/distribute-wrapper.test.ts:208`, `:234`,
  `:258`. Directly confirmed in this run: `/bin/ps -o lstart= -p $$` returns
  `operation not permitted` under this managed sandbox. No unrelated test or
  distribution logic was changed or skipped to manufacture a green gate.
- `git diff --check`: **PASS**.
- No install, commit, push, build, deployment or simulator verification.
  Component structure/style checks do not establish native visual acceptance.

## Historical verification — owner fix at 8d40125 + working edits

- `pnpm typecheck`: **PASS**.
- `pnpm lint`: **PASS**, zero warnings.
- `pnpm test:ui --runInBand` for all five place-import suites plus shared
  place-card: **PASS, 6 suites, 137 tests**.
- New regression coverage: Maps icon belongs inside the extracted card with
  and without a photo; 44×44 touch target and exact accessible label; same
  canonical `googleMapsUri` handoff; no action without URI; existing link-error
  copy on open failure; no candidate save, lock explanation or +50 copy;
  existing GoGo result still saves its canonical ID.
- `pnpm test`: **FAIL, 111 files passed, 1 failed, 1 skipped; 1311 tests passed,
  3 failed, 39 skipped**. The only failures remain the unchanged
  `src/shared/config/__tests__/distribute-wrapper.test.ts:208`, `:234`, `:258`
  process-liveness cases. Verified directly in this run: `/bin/ps -o lstart= -p $$`
  is rejected with `operation not permitted`. This sandbox limitation prevents
  a green full-suite gate. No tests were skipped or unrelated logic modified.
- `git diff --check`: **PASS**.
- File edits and local checks only. No install, commit, push, build, deployment
  or simulator verification. The #518 header pill is not present in this branch;
  this patch removes #516 duplication without claiming full wizard integration.

## Historical verification — owner fix at c01b1ff + working edits

- `pnpm typecheck`: PASS.
- `pnpm lint`: PASS, zero warnings.
- `pnpm test:ui --runInBand` for all five place-import suites plus shared
  place-card: **PASS, 6 suites, 132 tests**.
- `pnpm test`: **FAIL, 111 files passed, 1 failed, 1 skipped; 1311 tests passed,
  3 failed, 39 skipped**. All three failures are in unchanged
  `src/shared/config/__tests__/distribute-wrapper.test.ts` (lines 208, 234, 258),
  whose process-liveness checks need `ps`. This managed sandbox rejects `ps`
  with `operation not permitted`; the owner-liveness test receives no stdout,
  and the two process-group checks cannot detect the live child. No unrelated
  distribution code/tests were altered or skipped to manufacture a green gate.
- `git diff --check`: PASS.
- Regression includes single verification confirmation, removed photo/section/
  header badges, combined first-photo credits, multiple authors and author-link
  handoff, distinct credit retention, unavailable/failed photos, no caching,
  long clipboard paste/clear, input lifecycle, resolver token reset, outages,
  future hours, shared header bell navigation/unread-dot/zero-unread behavior
  on both import stages, and existing shared PlaceCard behavior.
- No contract/schema change, install, commit, push, build or deployment. No
  simulator rendering or owner visual acceptance claimed; native horizontal
  scrolling still needs device confirmation. Full repository test gate remains
  blocked by sandbox process-inspection access as detailed above.
