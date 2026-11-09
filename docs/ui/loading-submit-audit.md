# Shared loading and submit overlay (#584 / #586)

Owner feedback: 2026-11-09. UI-only follow-up on `feature/GOGO-584-loading`.

The shared `BlockingLoadingOverlay` uses `theme.overlay.submit`: the theme canvas
at 85% alpha, with both colours defined in `tokens.ts`. It blocks the whole native
window and retains the existing button busy states. `useSubmitOverlay` delays
follow-up sheets until the native overlay has dismissed.

`LoadingIndicator` remains 48×48 by default. It renders the supplied option A
infinity path in a 400×320 SVG, a white 7-unit beam with native SVG glow copies,
`85 255` dashes and 760→0 offset in 2.4 seconds. The bounce follows
0/−7/−2/−5/0 at 0/32/48/64/100% over 2 seconds. The two stars pulse independently
at 2.4 and 2.8 seconds (the second starts after 0.5 seconds). Artwork colours come
from `brandLogo`. All four animation clocks stop for reduced motion, including
while the system preference is unknown.

## Screens/components changed directly

- Account: account save/export/delete and avatar removal; avatar editor upload;
  theme accent save.
- Create date: final create-room step (`create-mood`); save draft; save/discard
  and exit (`wizard-actions`). Intermediate steps only update the local draft.
- Join: join by code; guest join; Home quick join.
- Room: title editor; schedule editor; room management; invitation/start actions
  on the room screen.
- Preferences/matching: room preference submit; match result finalization and
  regeneration.
- Review: edit an existing review (`my-reviews`).
- Places: import link verification/final submission; contribution wizard draft
  save (including supplements); place report; Saved link form.
- Active date: complete stop and check-in submit. The overlay survives the final
  stop changing the underlying screen branch before check-in opens.
- Plan: edit/save itinerary; start and regenerate plan.
- Notifications: category settings save; master notification switch save.
- Assistant: message POST acknowledgement; rename conversation; proposal
  confirmation/dismissal. The reply stream stays interactive so Stop remains usable.

## Existing form owners covered through the shared component

Sign-in and sign-up (`auth/sign-in`), logout (`tabs/profile`), profile defaults,
and new review submission already used `BlockingLoadingOverlay`; they receive the
new backdrop and artwork without another screen implementation.

Forgot password is an `UnavailableAction` with recovery-unavailable copy. There
is no recovery form or mutation to wire; this change does not invent an endpoint.
Bookmark/like/vote gestures, permission prompts, photo picking/background uploads,
and list/query loading are not form submissions. They retain their existing
inline states. Submitted avatar uploads are blocked in the avatar editor.

The explicit 33-owner coverage guard is
`src/shared/ui/__tests__/submit-overlay.test.ts`. Native component tests cover
busy/dismissal behaviour, reduced-motion cancellation/static stars, and SVG beam
geometry. Device animation appearance and native presentation still need owner
simulator acceptance; unit results do not establish that acceptance.

## Local verification

- `pnpm typecheck` and `pnpm lint`: pass.
- Full `npx vitest run`: 1,733 pass / 39 skipped / 3 fail in the existing
  distribution-wrapper process/lock suite. This environment denies process-table
  access (`ps`); one failure reads undefined stdout, and two cannot detect live
  build groups.
- That fixture also invokes git in temporary repositories. This was discovered
  after the first full run; the concurrent default `pnpm test` was stopped.
  No direct git command was issued against the working repository.
- `npx vitest run --exclude src/shared/config/__tests__/distribute-wrapper.test.ts`
  and `pnpm test --exclude src/shared/config/__tests__/distribute-wrapper.test.ts`:
  each passes 1,710 tests, with 39 skipped.
- The full native UI run passed 229 suites and exposed two failing suites. The
  overlay lifecycle test was corrected to exercise the hook's dismissal callback
  directly; the rebased list-loader test needed the current notification hooks
  and test IDs. Both suites pass on the focused rerun after those test-only repairs (11 tests).
