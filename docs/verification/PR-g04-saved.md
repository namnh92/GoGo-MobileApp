# Group 04 — Đã lưu

Owner decisions: **2026-11-07**. Branch `feature/GOGO-482-redesign-g04-saved`, stacked on #518/#516. No commit/push. Current-area #520 is deliberately not implemented here.

## Design evidence and limits

Target: [Đã lưu - GoGo](https://stitch.withgoogle.com/u/2/projects/17315762413421369447?node-id=6045502163558025217), project `17315762413421369447`, screen `6045502163558025217`.

Implementation follows sections 1, 2 and 4 of `/Users/maxnguyen/MyWorks/GoGo/dev/handoffs/codex-g04-plan.sol.out` plus the dated decisions in this task. That analysis records reading the screen HTML and 390×1540 screenshot. **This run could not refresh those artifacts:** the read-only Stitch script reports `STITCH_API_KEY is not set`; Chrome and in-app browser both report `The browser access host is unavailable`. No source image is fabricated or substituted from a different project.

**Light visual comparison: BLOCKED**, no simulator screenshot pair captured in this run. **Dark: FAIL parity** — no Dark Stitch pair identified in this destination project in the supplied analysis; live inventory refresh is blocked. Dark app styles use the existing `redesignDark` / `night` tokens, with the same component tree and data as Light. Token/structural tests do not establish pixel parity. Visually verified pairs: **0/1**. Do not report this screen as 100% matched or accepted.

## Stitch → app

| Stitch element | Implementation / source | Verification state |
| --- | --- | --- |
| GoGo · Đã lưu; bell/unread dot | Shared HeaderNotificationButton; actual inbox first-page unread facts; no avatar | Implemented; visual pending |
| Quick save URL + Lưu | Google Maps URL validator shared with import; BFF resolve, PUT saved for ALREADY_EXISTS; otherwise `/places/import?url=…` | Behavior tested |
| Three selected/check filters + counts | Counts from full Saved response, before filtering | Behavior tested |
| Area headings, color dot, counts | Canonical province → commune grouping; current area GPS/profile fallback | Behavior tested; TODO #520 |
| Xem cụm | Shared group-02 MapCanvas, only saved place pins in that area group; no plan stops or search results; list fallback when map unavailable | Pin membership tested; device map pending |
| Full-width 16:10 place card | Shared PlaceCard `appearance="saved"`, also used by Đóng góp của tôi | Structural tests; visual pending |
| Photo hours, category, distance | Hours derived with shared Vietnam clock and foreground refresh; category/tags resolved from CMS; straight-line GPS distance explicitly labelled | Pure/structural tests |
| ⋮ / Bỏ lưu / Chia sẻ | Shared Sheet actions; optimistic unsave with rollback; canonical BFF share link + native Share after the menu closes | UI removal tested; native share pending |
| Name + price/unit; pin/address | Shared adapter and address formatter; price unit retained, unknown omitted | Shared card tests |
| Two rating badges with counts | Google provider and GoGo community scores stay separate; below threshold, words plus actual count | Saved card tests |
| CMS taxonomy tags | All available labelled taxonomy keys; no guessed/raw-key labels; chips keep text on one line | Adapter/card tests |
| Unavailable card | Provider closed/temporarily_closed/moved and known moderation takedowns; dim image, struck title, factual warning and remove | Fact tests; visual pending |
| Tìm quán tương tự | Ordinary Search with same category + canonical area; hidden if either fact is missing; no AI invocation | Search parameter test |
| Plan image/title/timeline | Position-ordered first stop photo; room title + scheduled date (first arrival date fallback); real stop arrival times/names | UI/pure tests |
| Điều kiện đã đổi / unavailable stops | Preserve SavedItem.conditionsChanged, Plan.isStale, hasUnavailableStops and stop.unavailableReason | Hook/UI tests |
| Xem lại & điều chỉnh / Đi ngay | `/plans/{id}` / existing `/plans/{id}/active` route | UI navigation tests |
| Save/unsave toast | Lightweight inline live-region message, clears after 3.5s; errors use shared ResultSheet | Link success/error tests |
| Empty / guest / loading / failure / offline | Existing shared states; retry includes failed detail queries; transient detail errors are not called closed venues | UI/hook tests |
| Bottom tabs | Existing app dock and Assistant FAB retained from stack | Visual reconciliation pending |

## Dated owner deviations (2026-11-07)

- Google Maps only. TikTok/Instagram removed from scope; no unsupported resolver or new BE issue created for them.
- Existing GoGo link saves immediately; new place links open the existing Nhập link → Bổ sung thông tin flow with URL prefilled. This does not submit or auto-save an unreviewed new venue.
- Xem cụm maps saved **places only**, including in mixed place/plan groups. A group with no readable saved places has no enabled map action. Unknown/multi-province groups retain their existing honest labels.
- Similar means same category + area through Search, with no AI. If detail is inaccessible and category is unknown, the control is omitted; no category is invented.
- Đi ngay opens the existing active-date screen for that plan; it does not launch a made-up directions flow or change room status.
- Plan title/image derive from real room/date/first-stop facts. Generic existing “Kế hoạch đã lưu” is the fallback when title/date are absent; no “Lộ trình tối” or stock photo.
- Removed sample “Kín chỗ trước 21h”, replacement-place warning and “Phục hồi danh sách mẫu”. No capacity assertion or replacement recommendation is fabricated.
- Header uses brand + bell, no avatar.
- Stitch toast intent is implemented as inline lightweight feedback for successful save/unsave. Actual failed operations use the shared ResultSheet; menus/maps use shared Sheet. Native sharing waits for menu dismissal.
- Unknown fields are omitted, including price, hours, GPS distance and unlabelled CMS keys. Detail 403/404/410 remains removable without fabricated name/image; transient/network failures retain retry.

## Contract and stack compatibility

`openapi/gogo.v1.yaml` is verbatim `git -C /Users/maxnguyen/MyWorks/GoGo/dev/worktrees/be-796 show origin/re-design:openapi/gogo.v1.yaml` (**7.3.0-alpha.1**, BE commit `45d9d0822bef579929b603032e6e6b0dca37bc93`). Both blobs: `ac2806f5e810ee3b4e66d4e47faee23eb111d8f8`. Main generated schema is regenerated from that file, without hand edits.

That BE snapshot lacks the contribution-draft operations and three enrichment/draft schemas already used by #516. `src/shared/api/stacked-contribution-schema.d.ts` preserves those generated declarations verbatim from stack HEAD `b5cf7a1`; `types.ts` composes them with the generated BE schema. It introduces no endpoint or runtime behavior. This is explicit stack compatibility, **not evidence the deployed BE implements drafts**. Remove the snapshot when the BE contract includes the stacked draft feature. Existing draft endpoint tests remain in the validation set.

Sources remain BFF endpoints: `/me/saved`, `/places/{id}`, `/plans/{id}`, `/rooms/{id}`, `/taxonomies`, `/me/notifications`, `/places/resolve-google-maps-link`, `/share-links`. No direct provider calls were added.

Telemetry reuses `place_saved` (`source=saved_link`); Search itself emits the existing `place_search_opened` event once on entry, without a duplicate click event. Link URLs, taxonomy/area values, names and resolution tokens are not sent in these events.

## Checks and remaining acceptance

- `pnpm install --frozen-lockfile`: passed; lockfile unchanged.
- `pnpm api:types`, `pnpm api:check`: passed; verbatim BE blob equality checked.
- `pnpm typecheck`, `pnpm lint`: passed.
- `pnpm test:ui --runInBand`: **186 suites / 2,215 tests passed**. Latest focused rerun covering Saved, links, cards, contributions and saved-query hydration/sign-out: **5 suites / 82 tests passed**. Includes ordinary Search category+area entry, position-ordered plan image/title/times, Google-only auto-save/wizard routing, rating counts/price units, below-threshold community sample size, private-cache sign-out guard and detail-error retry.
- `pnpm test`: **116 suites passed, 1 failed, 1 skipped; 1,334 tests passed, 3 failed, 39 skipped**. All five new pure Saved tests passed. Contract integration suite is skipped by default; no remote data-writing contract run was requested.
- `git diff --check`: passed.
- Full `pnpm test` currently fails three existing distribution lock/process tests because this managed sandbox denies `ps` (`operation not permitted`) and `pgrep` cannot get the process list (`sysmond service not found`). The distribution script and its tests are unchanged. Do not weaken those tests or change distribution code to make this UI task appear green.
- Pending: live Stitch HTML/screenshot refresh; Light app comparison; destination Dark pair + parity; native map/share smoke test. No DEV/backend acceptance or deployment claimed.
- Open integration question: when will the BE contract include #516's draft API? Current-area integration is an explicit TODO(#520) at the Saved grouping boundary, to resolve on rebase.
