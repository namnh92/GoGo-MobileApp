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
| `features/matching/preference.view` | `useTaxonomies`, `useMyPreferences`, `useSaveMyPreferences`, `useCompleteMyPreferences` |
| `features/matching/swipe.view` | `useCurrentSuggestions`, `useCastVote` |
| `features/matching/waiting.view` | `useRoomMembers` + `useRoomRealtime` |
| `features/matching/matching.view` | `useStartMatching`, `useCurrentSuggestions` |
| `features/matching/match-result.view` | `useCurrentSuggestions`, `useFinalizeVotes`, `useGenerateSuggestions` |
| `features/date-plan/date-plan.view` | `usePlan`, `useLockPlanStop`, `usePlanStopPlaces` |
| `features/active-date/active-date.view` | `usePlan`, `useCompletePlanStop`, `useCheckinPlanStop` |
| `features/active-date/checkin-sheet.view` | rating/tags/note only — see below |
| `features/active-date/date-finished.view` | `usePlan` |

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

### Phase 2 — suggestions and votes ✅ done

`preference.view`, `swipe.view`, `waiting.view`, `matching.view`,
`match-result.view`.

Decisions made while migrating:

- **The swipe deck's three actions map onto the three vote values** the contract
  counts: pass → `no`, like → `yes` (1 point), star → `star` (2 points). There
  is no "maybe" server-side, so the middle action was relabelled rather than
  left looking non-committal while scoring a point.
- **The refinement sheet was removed.** It collected structured reasons and free
  text, and no endpoint accepts them — `generateSuggestions` takes no body and
  AI refinement is behind a disabled flag. The host now gets a plain
  "regenerate", and the guest's "suggest to the host" action is gone until
  there is somewhere to send it.
- **Timers no longer drive navigation.** `waiting.view` advances when the room
  actually reaches `matching`, and `matching.view` advances when a run exists.
  The copy still cycles on a timer; the routing does not.
- **A member can no longer trigger matching.** Only the host runs the pipeline
  (server-enforced), so a member sees "waiting for the host" instead of a
  spinner that never resolves.

### Phase 3 — plan ✅ done

`date-plan.view`, `active-date.view`, `checkin-sheet.view`,
`date-finished.view`.

Decisions made while migrating:

- **Locks moved from a time string to `stop.id`.** They were keyed by `'18:30'`
  and held in Zustand; a lock is server state that must survive regenerate, so
  it now goes through `useLockPlanStop` and the returned plan is the truth.
- **Progress comes from `stop.status`, not a local counter.** The active-date
  screen resumes correctly after a reload or on a second device.
- **Check-in ships without photos or the verified bill.** The API takes
  `photoKeys` and `billPhotoKey` — keys of already-uploaded objects — and the
  contract has no client upload path (GoGo-BE#171). `billTotal` is rejected
  without `billPhotoKey`, so a bill form could never submit. The fields are
  removed with a visible note rather than collected into a dead form.
- **Check-in tags travel as stable keys.** `tags` is free-form `string[]` with
  no `checkin_tag` taxonomy, so sending the localised label would store
  "Muốn đi lại" for one user and "Would go again" for another.
- **`checkinStore` and `roomStore.lockedStops` are deleted** — both held server
  state.

### Phase 4 — saved, reviews, home ✅ done

`review.view`, `shared-result.view`, `plans.view`, `home.view`.
(`saved.view` landed with the places vertical.)

Decisions made while migrating:

- **Review highlight chips removed.** `POST /reviews` takes `rating` and `text`
  only — no tags field and no review-tag taxonomy (GoGo-BE#171). The note input
  was also uncontrolled, so whatever the user typed was never read.
- **`shared-result` now shows real numbers.** It invented "Food compatibility
  88%", "Budget harmony 94%" and a 4.7/5 rating. It renders the ranking
  pipeline's own explainable score components instead — `budget`, `consensus`,
  `preference`, `distance` — plus stop count, duration and cost from the plan.
  The headline figure is labelled as GoGo's match score, not a user rating.
- **`plans.view` lists rooms opened on this device**, refetched for live status,
  and says so on screen. Without `GET /rooms` (GoGo-BE#152) there is no history
  to show, and a fabricated "Japanese + Pottery" card was standing in for it.
- **Home's rail is a real curated search**, and its loading / empty / error
  branches come from the query rather than only from the demo state flag. The
  stock-photo hero is now a brand surface.
- **The mock layer is gone**: `src/shared/api/mock.ts`, `src/data/mockData.ts`
  and `src/data/taxonomy.ts` are deleted. `src/data/types.ts` keeps only the
  `Mood` shape the i18n content bundle is typed with.

### Phase 5 — notifications ✅ done

Two new screens: the inbox (`/notifications`) and per-channel preferences
(`/settings/notifications`), both reachable from Profile. The Profile settings
rows used to be labels with no handler; rows without a destination now say so
instead of silently doing nothing.

- The inbox is cursor-paginated, marks a notification read on open, and routes
  by `kind` using the ids in the payload.
- Preferences cover every `NotificationKind` × channel the contract defines, so
  a new kind cannot become silently unreachable. An absent entry means the
  server default, which is on.
- **`registerDeviceToken` is deliberately not called.** A device token needs a
  real device plus APNs/FCM credentials, and neither is configured — the BE's
  `APNS_*` and `FCM_*` settings are empty. The screen says so rather than
  implying push already works. The hook exists for when it does.

| Screen | Hook | Trap to fix |
| --- | --- | --- |
| `review/review.view` | `useCreateReview` | Nothing is persisted; navigates using the mock `INVITE_CODE`. New reviews come back as `pending` moderation — do not render them as published. |
| `review/shared-result.view` | `usePlan` + room facts | Stats are entirely hardcoded. |
| `tabs/plans.view` | `useRecentRoomsStore` + `useCurrentPlan` | Hardcoded upcoming card. There is no `GET /rooms`, so the room list comes from the local recent-rooms store. |
| `home/home.view` | `useRecentRoomsStore`, `usePlaceSearch` | Renders loading/empty/error from the demo `uiState` flag rather than real query state. |

## Cross-cutting changes these depend on

1. **Identity.** No mock entity has an id: places key on `title`, stops on a
   `'18:30'` time string. Places are done — `bookmarkStore` and `importStore`
   are deleted and `roomStore.seedPlaces` now holds real place ids. Still on
   strings — none left: `roomStore.lockedStops` and `checkinStore` are deleted,
   and locks and check-ins now key on `stop.id`.
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

## Screens added after the five phases

Everything the API layer already covered but no screen reached:

| Screen | Why it mattered |
| --- | --- |
| Rebuild the plan (`date-plan`) | `useRegeneratePlan` had no caller, so RULE-CORE-007 — locked stops survive a rebuild — was verified in tests but unreachable in the app |
| Edit the route (`/plans/[planId]/edit`) | Reorder or drop stops via `useEditPlanStops` |
| Manage room (`/room/[roomId]/manage`) | Edit constraints, list and revoke invites, remove members, attach seed places, cancel the room |
| Account (`/settings/account`) | Edit the profile, export data, delete the account — APP-009 requires the delete/export entry point |
| My reviews (`/settings/reviews`) | List and edit own reviews with their moderation status |
| Join with a code (`/join`) | The only way in was an invite link |
| Place submission metadata (PI-APP-004) | Category, vibes, estimated price and a note, plus polling the submission until a moderator decides |

Android app links now cover `/plans`, `/places` and `/room`, not just `/r`.

## Workarounds to remove when the backend catches up

| Workaround | Remove when | Then |
| --- | --- | --- |
| `PlacePhoto` neutral placeholder | GoGo-BE#151 | Map `primaryPhoto` / `photos[]` into `PlaceCard.photoUrl` and render real imagery with its attribution |
| `recentRoomsStore` as the room list | GoGo-BE#152 | `GET /rooms` becomes the source of truth; the store is demoted to cache / offline fallback |
| `pollingTransport` | GoGo-BE#154 | Add an SSE transport; keep polling as the fallback when the stream drops |
| `createAndOpenRoom`, `ensureRoomMatching` | GoGo-BE#155 | Delete both, and update the contract test that pins `status === 'collecting'` after creation |
| Check-in without photos or bill | GoGo-BE#171 | Restore the photo picker and the verified-bill form once an upload path exists |
| `toNumber`, `parseApiDate` in `view-models.ts` | GoGo-BE#169 | Delete both once `GET /places/{id}` returns a mapped DTO instead of the raw SQL row |
| `areaLabel` omitting `areaKey` | GoGo-BE#169 | Render the area once there is a label source for the key |

## Found by running the app, not by the gates

Typecheck, lint, unit tests and a clean bundle all passed while these were
broken. Each is pinned by a regression test now.

1. **`expo-crypto` unresolved at runtime.** A Metro dev server left running from
   before the dependency was installed served a stale haste map. Restart Metro
   with `--clear` after adding a native module.
2. **`detail.rating.toFixed is not a function`.** Postgres `numeric` columns
   arrive as strings (`"4.60"`) through the raw-row DTO, while the generated
   type says `number` — so TypeScript cannot see it.
3. **"Invalid Date" rendered on screen.** `freshness_checked_at` comes back as
   `2026-08-26 23:40:14.332+00`, which Hermes will not parse.
4. **A raw internal key shown to users.** `areaKey` (`hcm_q3`) has no label
   source anywhere in the contract.

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
