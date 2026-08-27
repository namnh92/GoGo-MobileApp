# Mock → API migration status

The API layer (`src/shared/api`) is complete and verified against a running
GoGo-BE: every consumer endpoint in `openapi/gogo.v1.yaml` has a typed wrapper
and a TanStack Query hook. What remains is per-screen work — replacing the
fixtures in `src/data/mockData.ts` with those hooks.

Run the gate before and after each screen:

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm test:contract   # needs GoGo-BE running; see docs/adr/0001-api-integration.md
```

## Done

| Screen | Now uses |
| --- | --- |
| `features/auth/sign-in.view` (new) | `useSession().signIn` / `signUp`, `react-hook-form` + zod |
| `features/gogo-room/guest-join.view` | `useSession().joinAsGuest` — real room-scoped guest session |
| `features/gogo-room/gogo-room.view` | `useRoom`, `useCreateRoomInvite`, `useStartMatching`, member polling |
| `features/create-date/create-location.view` | `useAreaAutocomplete` (BFF Places proxy) + provider attribution |
| `features/create-date/create-time.view` | writes ISO-8601 `startAt` / `endAt` to the draft |
| `features/create-date/create-budget.view` | writes `budgetAmount` in integer minor units |
| `features/create-date/create-mood.view` | `useTaxonomies` for stable keys, `useCreateRoom` |
| `features/tabs/profile.view` | `useMe`, real logout with full cache purge |
| `features/search/search.view` | `usePlaceSearch` — every filter is a server param, cursor paging |
| `features/date-plan/place-detail.view` | `usePlaceDetail(placeId)`, real hours/suitability/attribution |
| `features/tabs/saved.view` | `useSavedPlaces`, `useToggleSaved` |
| `features/place-import/import.view` | `useResolveGoogleMapsLink` + `useSubmitPlace` |

`bookmarkStore` and `importStore` are deleted — both held server state.

## Remaining, migrated per vertical

Order: **places → suggestions/votes → plan → saved/reviews → notifications.**

One vertical at a time, so each phase finishes a user flow rather than leaving
the app half mock and half API for long. Do not pick screens off at random —
a half-migrated vertical is harder to reason about than an unmigrated one.

Each row lists the hook to use and the specific trap in that screen's current
mock shape.

### Phase 1 — places ✅ done

`search.view`, `place-detail.view`, `saved.view`, `import.view`. `home.view`'s
discovery rail still reads `mockApi.suggestedPlans`; it needs room context to
build a sensible query, so it moves with the plan phase.

Decisions made while migrating:

- **The style-tag filter was removed from search.** The contract has no
  mood/style search parameter, and filtering client-side over a cursor-paged
  list only ever filters the page in hand — "no results" would be a lie. Add it
  back when search supports it server-side.
- **Distance filtering requires an origin.** Without location permission the
  only origin the app has is the wizard's area pick, so the distance field is
  replaced by an explanation when there is none. `sort=distance` is only ever
  sent alongside `lat`/`lng`, which the server requires.
- **The saved map projects real coordinates.** Markers were fixed percentages;
  they now normalise real `lat`/`lng` into the view box, so relative geometry is
  true. There is still no basemap — that needs the map-SDK ADR.
- **Saved and bookmarking require an account.** Guests get 403 `USER_ONLY` on
  `/me/saved`, so the control is hidden rather than offered and then refused.

### Phase 2 — suggestions and votes

`preference.view`, `swipe.view`, `waiting.view`, `matching.view`,
`match-result.view`.

### Phase 3 — plan

`date-plan.view`, `active-date.view`, `checkin-sheet.view`,
`date-finished.view`.

### Phase 4 — saved and reviews

`saved.view` (mutations), `review.view`, `shared-result.view`,
`plans.view`.

### Phase 5 — notifications

Inbox, `registerDeviceToken`, and push-tap routing. Push is only a trigger:
the app refetches from the API on open.

| Screen | Hook | Trap to fix |
| --- | --- | --- |
| `matching/preference.view` | `useTaxonomies`, `useMyPreferences`, `useSaveMyPreferences`, `useCompleteMyPreferences` | Selections are localised labels; the API wants stable keys per taxonomy kind. Send `expectedVersion` from the last read. |
| `matching/swipe.view` | `useCurrentSuggestions`, `useCastVote` | Votes are local counters today. `swipeCards` is imported directly, bypassing Query. Vote values are `yes` / `no` / `star`, not like/dislike/maybe. |
| `matching/waiting.view` | `useRoomMembers` + `useRoomRealtime` | Partner progress is a `setInterval` fake. `groupMembers` is a direct fixture import. |
| `matching/matching.view` | `useGenerateSuggestions` | Pure timer theatre — 1200/2400/3200ms then navigate. |
| `matching/match-result.view` | `useCurrentSuggestions`, `useFinalizeVotes`, `useRegeneratePlan` | Hero title and `planTotal(750)` are hardcoded. Regenerate is a 600ms fake; the real one returns the new plan and must preserve locked stops. |
| `date-plan/date-plan.view` | `useCurrentPlan` / `usePlan`, `useLockPlanStop` | Locks are keyed by the `'18:30'` time string. Use `stop.id`. `timeline` is a direct fixture import. |
| `active-date/active-date.view` | `usePlan`, `useCompletePlanStop` | `const stops = timeline`. Stop completion is local only. |
| `active-date/checkin-sheet.view` | `useCheckinPlanStop` | Sends local photo URIs; the API wants uploaded `photoKeys`, and `billTotal` requires `billPhotoKey`. Needs an upload step first. |
| `active-date/date-finished.view` | `usePlan` | Reads `checkinStore`, keyed by time string. |
| `review/review.view` | `useCreateReview` | Nothing is persisted; navigates using the mock `INVITE_CODE`. New reviews come back as `pending` moderation — do not render them as published. |
| `review/shared-result.view` | `usePlan` + room facts | Stats are entirely hardcoded. |
| `tabs/plans.view` | `useRecentRoomsStore` + `useCurrentPlan` | Hardcoded upcoming card. There is no `GET /rooms`, so the room list comes from the local recent-rooms store. |
| `home/home.view` | `useRecentRoomsStore`, `usePlaceSearch` | Renders loading/empty/error from the demo `uiState` flag rather than real query state. |

## Cross-cutting changes these depend on

1. **Identity.** No mock entity has an id: places key on `title`, stops on a
   `'18:30'` time string. Places are done — `bookmarkStore` and `importStore`
   are deleted and `roomStore.seedPlaces` now holds real place ids. Still on
   strings: `roomStore.lockedStops` and `checkinStore`, both keyed by stop time
   rather than `stop.id`.
2. **Money.** Mocks use `priceK` (thousands of VND, "total for two"). The
   contract uses integer minor units. `src/shared/pricing/money.ts` is the
   replacement; `usePriceFormatter` still speaks `priceK` and should be retired
   as screens move over.
3. **Taxonomy.** `viContent.moods` / `settings` / `spendingStyles` /
   `prefOptions` / `reviewTags` / `searchFilters` / `stopCategories` are
   localised labels used as state values. Taxonomy must come from
   `GET /taxonomies` as stable keys, with labels resolved for display only.
   `create-mood.view` shows the pattern.
4. **Images.** The contract exposes **no place photo field** — `PlaceSearchResult`
   and `PlaceDetail` have none, and check-in `photoKeys` are user uploads under
   moderation. Ten views still render `unsplashUrl(place.img)`, showing an
   unrelated stock photo as if it were the place. **Decided:** API-backed places
   render `PlacePhoto`, which falls back to a neutral, deterministic placeholder;
   no stock photo ever stands in for a real venue. `PlaceCard.photoUrl` is the
   seam — it becomes `primaryPhoto` when GoGo-BE#151 ships.
5. **Realtime.** There is no SSE or WebSocket endpoint (GoGo-BE#154). **Decided:**
   polling is transitional and lives only in `src/shared/api/realtime/`. Screens
   call `useRoomRealtime(roomId, phase)` and declare a phase, never an interval;
   the data hooks expose no `refetchInterval` at all, so cadence cannot leak back
   into a screen. Swapping in SSE means adding one transport and keeping polling
   as the fallback when the stream drops.

## Workarounds to remove when the backend catches up

| Workaround | Remove when | Then |
| --- | --- | --- |
| `PlacePhoto` neutral placeholder | GoGo-BE#151 | Map `primaryPhoto` / `photos[]` into `PlaceCard.photoUrl` and render real imagery with its attribution |
| `recentRoomsStore` as the room list | GoGo-BE#152 | `GET /rooms` becomes the source of truth; the store is demoted to cache / offline fallback |
| `pollingTransport` | GoGo-BE#154 | Add an SSE transport; keep polling as the fallback when the stream drops |
| `createAndOpenRoom`, `ensureRoomMatching` | GoGo-BE#155 | Delete both, and update the contract test that pins `status === 'collecting'` after creation |

## Backend notes worth keeping

- A room is created in `draft`, and the auto-flip to `matching` only fires when
  the last member completes preferences **while the room is already
  `collecting`**. `createAndOpenRoom` and `ensureRoomMatching` in
  `endpoints/rooms.ts` handle this; a room left in `draft` silently dead-ends
  with `ROOM_NOT_MATCHING` at the suggestion step even though
  `completeMyPreferences` answered `roomReadyForMatching: true`.
- `matching` has no self-loop in the state machine, so re-transitioning an
  already-matching room returns 409 `INVALID_ROOM_TRANSITION`.
- `pnpm dev` in GoGo-BE fails: the docs controller reads
  `openapi/gogo.v1.yaml` from `process.cwd()`, which the filtered script sets to
  `apps/api`. Start the API from the repo root instead.
