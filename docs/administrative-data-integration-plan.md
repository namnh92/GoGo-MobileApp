# Administrative data on Mobile — integration plan

**Status: DEFERRED — NO CURRENT CONSUMER.** ADM-201 / [#148](https://github.com/namnh92/GoGo-MobileApp/issues/148).

This is a plan, not a staging area. **No code ships from it.** It exists so that
when a feature does need normalized Vietnamese administrative data, the design
is already argued and nobody has to re-derive it under deadline — and so that
until then, nobody adds a hook, a cache key or a version poll "to be ready".

The deferral is a scope decision, not a gap. It does not block GoGo-BE or
GoGo-CMS, both of which have shipped their halves.

## Why deferred: the verified evidence

Measured on `origin/develop` (`3a80864`), across `src/**/*.ts{,x}` excluding the
generated `schema.d.ts`:

| search | business hits |
| --- | --- |
| `administrative` | **0** |
| `province` | **0** |
| `commune` | **0** |
| `ward` | **0** |
| `district` / `city` | 10 / 9 — **all of them `expo-location` reverse-geocoding labels** |

Every `district` and `city` hit lives in `src/shared/location/area-label.ts` and
its tests, or in one comment in `src/shared/ui/place-card.view.tsx`. Those are
**display strings from the device's geocoder**, used to render a line like
"Thảo Điền, TP.HCM". They are not administrative codes, they do not come from
GoGo-BE, and nothing submits them anywhere. That distinction is the whole point
of the § Privacy and provider rules below.

Structurally:

- **No address-entry screen.** Nothing anywhere in `src/features` accepts a
  typed address.
- **No province or commune selector**, and no picker of any kind for an
  administrative unit.
- **No screen renders normalized commune data.** `PlaceCard` shows the
  provider's address line, falling back when the district is absent.
- **`src/features/place-import` is add-by-link only** — two files,
  `import.view.tsx` and `import.style.tsx`, and the flow is a Google Maps URL in,
  a resolved candidate out.
- **The vendored contract has no administrative endpoint at all.**
  `openapi/gogo.v1.yaml` is `1.0.0-alpha.1` and contains **zero** `/administrative`
  paths. Its only four mentions of the word are field descriptions on an address
  string, one of which says it outright: *"Administrative address; free text,
  **never a code**."*

So the units GoGo-BE publishes have, today, nowhere on Mobile to be displayed,
filtered by, selected from, or corrected. Shipping query hooks, a persistence
namespace and version polling now would be **dead integration** — code with no
caller, kept alive by tests that only exist to keep it alive — which
`.claude/rules/core.md` #16 refuses:

> **No dead controls.** A button with no handler, or one wired to a non-existent
> endpoint, must not ship looking operable.

The same argument applies one layer down. A background poller that refreshes a
dataset no screen reads is a dead control the user cannot even see.

## The current flow, and why it needs none of this

```
Mobile
  └─ user pastes a Google Maps URL
     POST /places/imports { url }                    ← the ONLY thing sent
        └─ BE resolves the link to a provider place identity
           └─ BE retrieves permitted Place Details
              └─ BE Administrative Address Resolver maps the stored geometry
                 against GoGo's pinned administrative boundaries
                 └─ ambiguous or unresolved → CMS moderation queue
                    └─ editor publication requires a VERIFIED mapping
```

Mobile then submits the resolved identity, not an address:

```ts
// src/shared/api/endpoints/places.ts
submitPlace(body)   // POST /place-submissions { googlePlaceId, resolutionToken }
```

**Mobile sends a link, an identity and a short-lived resolution token. It never
sends an address, an administrative code, or a district name.** Administrative
resolution happens entirely on the server, against boundaries GoGo pins and
versions; ambiguity is adjudicated by a human in the CMS. The device is not in
that loop and does not need the dataset to stay out of it.

This flow is unchanged by this document and must stay unchanged by it.

## Activation triggers

Implementation begins **only** when an approved feature needs to do one of these:

1. Display normalized province or commune data to the user.
2. Filter places by an official administrative code.
3. Accept manual address entry.
4. Allow a user to correct or select an administrative unit.
5. Show a place's administrative mapping status.
6. Provide a province/commune picker.

Anything short of that — a nicer address line, a label on a card, a search
placeholder — is served by what the API already returns and does not justify a
dataset on the device.

### The prerequisite nobody should discover late

**Mobile's vendored OpenAPI must be re-vendored first.** At `1.0.0-alpha.1` the
administrative endpoints do not exist in the spec, so they do not exist in
`src/shared/api/schema.d.ts`, so `OpResponse<'listProvinces'>` will not compile.
Re-vendoring is its own task with its own review — `pnpm api:types` regenerates,
`pnpm api:check` gates the two against each other — and it is **not** justified
by this deferred plan on its own. See § Not now, explicitly.

## API contract, when activated

**GoGo-BE only.**

```
GET /v1/administrative/version
GET /v1/administrative/provinces
GET /v1/administrative/provinces/{provinceCode}/communes
GET /v1/administrative/search
GET /v1/administrative/units/{code}        (or resolve, where the use case needs it)
```

**Never call an upstream or public Vietnamese administrative API or dataset
directly**, and never bundle one. `.claude/rules/core.md` #12 states the general
rule — clients talk only to the BFF — and here it has teeth beyond architecture
hygiene: GoGo's units are *pinned and versioned*. A device reading a live
upstream source would disagree with the server about what a commune code means,
and 2,212 of 3,321 commune codes changed meaning on 2025-07-01. A code alone is
not an identity; a code plus a dataset version is.

All calls go through the existing client (`src/shared/api/client.ts`) and the
existing hook layer (`src/shared/api/queries/use-*.ts`). No parallel fetch path.

## Persistence, when activated

**Reserved conceptually. Do not create the key, the prefix or the namespace
now.**

The connecting point already exists and is one line:

```ts
// src/shared/api/persist-policy.ts
const PERSISTED_PREFIXES: readonly string[] = ['rooms', 'plans', 'places', 'me']
//                                                                     ↑ 'administrative'
```

That is the whole integration with Mobile's persistence, and it is deliberately
*not* made yet. The query cache is persisted to AsyncStorage under
`gogo.query-cache` by `queryPersister`, dehydrated per-query by
`shouldPersistQuery`, and discarded wholesale when `CACHE_BUSTER` in
`src/shared/providers/app-providers.tsx` changes. Administrative data would ride
that same machinery rather than inventing a second store.

Planned shape of what is retained:

| field | why |
| --- | --- |
| `datasetVersion` | the server's identity for the data; the only thing that makes a code meaningful |
| `schemaVersion` | our own shape version, so a client-side format change can invalidate without a server change |
| last valid province snapshot | what renders on a cold, offline start |
| commune snapshots keyed by **province code and dataset version** | so a commune list can never be read against the wrong version |
| `fetchedAt` | staleness for display and for refresh decisions, not for correctness |
| validation state / checksum | if the endpoint offers one; absent otherwise, never invented |

**No hard-coded list of provinces or communes is ever the source of truth.** Not
as a seed, not as a fallback, not as a test fixture that leaks into runtime. A
bundled list is a dataset version frozen at build time that nothing will ever
invalidate — the exact failure the versioning exists to prevent.

Query keys would follow the existing factory in `src/shared/api/query-keys.ts`,
with the discriminator immediately after the root, because `shouldPersistQuery`
scans string segments and the position matters:

```ts
administrative: () => ['administrative'] as const,
administrativeVersion: () => ['administrative', 'version'] as const,
provinces: () => ['administrative', 'provinces'] as const,
communes: (provinceCode: string) => ['administrative', 'provinces', provinceCode] as const,
```

## Refresh behaviour, when activated

1. **Render the last valid local snapshot immediately.** Never a spinner over
   data that is already on the device.
2. **Check `/administrative/version` on app lifecycle**, using the existing
   `AppState` / `focusManager` wiring in
   `src/shared/api/query-client.ts::bindAppStateToQueryClient`. Not a timer.
3. **Do not poll while no administrative feature is active.** A background
   request for a screen nobody opened is battery and bytes spent on nothing.
4. **Refresh only when `datasetVersion` changes.** An unchanged version is a
   no-op, not a re-download.
5. **Deduplicate concurrent refreshes.** TanStack Query already collapses
   in-flight identical keys; the design must not add a second path that escapes
   that.
6. **Validate the complete new payload before replacing the snapshot.** Parse
   it, check the hierarchy, then swap — never mutate the live snapshot in place
   as pages arrive.
7. **On fetch or validation failure, keep the previous valid snapshot.** A
   failed refresh must leave the app exactly as capable as it was a second
   earlier. This is the same lesson APP-007 already taught the persister: it
   dehydrates anything with `data`, not only what most recently succeeded,
   because requiring `success` evicted the plan from disk after one offline
   refetch.
8. **Bound retained versions and storage.** Keep the active version and at most
   one predecessor; evict by version, not by age.
9. **Never mix province and commune data from different dataset versions.** A
   commune list keyed by province alone is a bug: reading it after a version
   change silently answers with units that no longer exist under that parent.

## Offline behaviour, when activated

| situation | behaviour |
| --- | --- |
| BE unreachable, valid snapshot present | continue on the snapshot; no error state |
| BE unreachable, **no** snapshot | recoverable loading/error state with a retry — never an empty picker that looks like "no provinces exist" |
| new response corrupt or fails validation | discard it, retain the previous snapshot, surface nothing to the user |
| user's stored selection is stale after a version change | submit it anyway; **BE revalidates** and returns a recoverable domain error, which the UI turns into a re-selection prompt |

Two rules hold regardless:

- **A display name is never submitted as an official code.** The user picks a
  label; the app submits the code that label was bound to, or nothing.
  `expo-location`'s `district` string is a label. So is Google's address line.
  Neither is a code, and the vendored spec says so in as many words.
- **The server is authoritative.** A device that has been offline for a month
  holds an opinion, not a fact. Client-side validation exists to give fast
  feedback, never to replace the server's answer.

## Privacy and provider rules, when activated

- **No Google `addressComponents`.** GoGo's product data architecture makes
  Google an identity, routes and directions provider — not a source of
  administrative classification.
- **No upstream administrative provider call from the device.** Ever. See
  § API contract.
- **No raw provider payload persisted** on the device.
- **Official codes come from GoGo-BE**, which resolves them against pinned,
  versioned boundaries.
- **The original display address and the normalized administrative
  classification stay distinct fields.** Collapsing them loses the ability to
  say "this is what the place calls itself" separately from "this is which
  commune it is in", and those disagree often enough to matter.

## Tests, when activated

Planned, not written:

1. Initial snapshot load with no cache.
2. Version unchanged → no refetch, no write.
3. Version changed → refetch, validate, swap.
4. Concurrent refresh deduplication.
5. Offline cold start renders the persisted snapshot.
6. Fetch failure falls back to the last valid snapshot.
7. Corrupt payload rejected, previous snapshot retained.
8. Persistence / schema-version migration.
9. Version-mixed snapshot rejected (commune from version A under province from
   version B).
10. Changing province clears the selected commune.
11. Hierarchy validation — every commune's parent exists in the same snapshot.
12. A stale selection is rejected by BE and the UI recovers.
13. Storage eviction keeps at most the bounded set of versions.
14. **No request to any upstream or public administrative API** — asserted at
    the transport layer, the same way the contract tests assert what is called.
15. **The add-by-link flow is unchanged** — a regression guard on the one flow
    this document must not disturb.

## Not now, explicitly

None of the following is part of this document's deliverable, and none of it
should be added "while we're here":

- query hooks for administrative endpoints
- a persistence key, prefix or namespace
- version polling of any kind
- fixtures or seed data
- a demo or preview screen
- a province/commune picker
- any change to `src/features/place-import`
- re-vendoring `openapi/gogo.v1.yaml` **for this work alone**. Mobile's drift
  policy is self-consistency — `pnpm api:check` regenerates `schema.d.ts` from
  the vendored spec and diffs it — and that gate is green at `1.0.0-alpha.1`.
  Nothing in the repository requires Mobile to track GoGo-BE's current version,
  so a re-vendor needs its own justification and its own review. It becomes a
  hard prerequisite the moment an activation trigger fires, and not before.

## Relationship to the BE and CMS workflow

| repo | shipped | role |
| --- | --- | --- |
| GoGo-BE | versioned dataset, boundaries, resolver, backfill, moderation and approval policy, observability | resolves geometry to administrative codes; **authoritative** |
| GoGo-CMS | dataset operations, source-drift adjudication, per-place mapping moderation | a human decides ambiguous mappings |
| GoGo-Infra | alerting on the administrative surface (ADR-0009) | notices when the above stops working |
| **GoGo-MobileApp** | **nothing, deliberately** | sends a link; reads whatever address the API returns |

Mobile is downstream of a decision it does not participate in, and that is the
correct shape while no screen asks the user about an administrative unit. When
one does, this document is the starting point — and its first instruction is to
re-vendor the contract.
