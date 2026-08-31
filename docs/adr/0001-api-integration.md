# ADR 0001 — Mobile API integration layer

- Status: accepted
- Date: 2026-08-27
- Scope: `GoGo-MobileApp` (WBS `APP-002`, prerequisite for `APP-004`…`APP-009`)

## Context

The app shipped as a mock-driven prototype: `src/shared/api/mock.ts` resolved
fixtures through `setTimeout`, there were no network calls anywhere in `src/`,
and no auth, session or token handling existed. Meanwhile `GoGo-BE` serves the
full `/v1` contract — all 94 spec paths are implemented and gated in CI by
`pnpm api:routes`.

We needed a typed client that consumes the BFF contract without hand-copying
types across repos (`RULE-API-001`), plus the session, offline and cache-purge
behaviour the mobile rules require.

## Decision

### 1. Types are generated, never written

`openapi/gogo.v1.yaml` is vendored from `GoGo-BE` and `src/shared/api/schema.d.ts`
is generated from it with `openapi-typescript` — the same tool and version the
backend uses, so both repos produce identical types.

- `pnpm api:types` regenerates.
- `pnpm api:check` fails when the committed types drift from the spec.

Endpoint wrappers derive their signatures from the generated `operations` map
via `OpBody` / `OpResponse` / `OpQuery` / `OpPath` helpers in `types.ts`, so a
contract change fails typecheck instead of failing at runtime.

### 2. A hand-written transport, not a generated one

`openapi-fetch` and similar generators give typed paths but not the behaviour
this client actually needs: Keychain-backed credentials, single-flight refresh
of a single-use token, idempotency keys, and error-envelope mapping. The
transport (`client.ts`, ~200 lines) is written once and everything above it is
generated or derived.

### 3. Session model

Two session kinds, both persisted per-key in `expo-secure-store`
(Keychain / Keystore), never in `AsyncStorage`:

| Kind | Credential | Renewal |
| --- | --- | --- |
| `user` | rotating single-use `refreshToken` | `POST /auth/refresh { refreshToken }` |
| `guest` | long-lived opaque `guestToken`, scoped to one room | `POST /auth/refresh { guestToken }` |

Refresh is **single-flight**. A single-use refresh token replayed concurrently
revokes the whole session family, so a burst of expired calls must produce
exactly one rotation. This is covered by a smoke assertion.

A 401 from refresh clears the session and fires `onSessionExpired`; a *network*
failure during refresh does not, so a subway tunnel cannot sign a user out.

### 4. Cache and offline

- `staleTime` 30s, `gcTime` 24h, retry only on genuinely retryable errors
  (`isRetryable` — 429/5xx/offline, never a 4xx that will fail again).
- `focusManager` and `onlineManager` are wired to `AppState` and `expo-network`;
  React Native fires neither on its own, so without this `refetchOnWindowFocus`
  and `refetchOnReconnect` are silently dead.
- Rooms, plans, places and `me` persist to `AsyncStorage` for the active-date
  offline requirement. Search results deliberately do not — a stale ranked list
  is worse than a spinner.
- Logout, account deletion and session expiry all purge the query cache, the
  persisted copy and the recent-rooms list.

### 5. Local recent-rooms list (temporary)

The contract has **no `GET /rooms`** (GoGo-BE#152) — a room is reachable only by
id. A user who leaves the flow would otherwise lose the room permanently, so
`recentRoomsStore` keeps the last 10 rooms in `AsyncStorage`. It stores room
facts only; invite codes are credentials and are never persisted.

This is a workaround, not a design: it knows only about rooms opened on this
device and goes stale as soon as anything changes elsewhere. When `GET /rooms`
lands, the server owns the list and this store becomes a cache / offline
fallback.

### 6. No stock photography

The contract carries no place imagery (GoGo-BE#151). `PlacePhoto` renders real
imagery when a URL exists and a neutral, deterministic placeholder otherwise.
The app never substitutes a stock photo for a real venue: people choose where to
go from that image, so a borrowed one is a false claim about the place.

## Consequences

- Screens must migrate off `src/data/mockData.ts`. The mock shapes have no ids
  (places key on `title`, stops key on a `'18:30'` time string), express money
  as `priceK` thousands rather than integer minor units, and bake display
  strings into data. Migration is tracked per-screen in
  `docs/api-migration.md`.
- Adding an endpoint means regenerating types and adding a wrapper plus a hook —
  no type is ever transcribed by hand.
- Realtime is polling for now, and deliberately fenced. The backend exposes no
  SSE or WebSocket endpoint despite `SSE-first` being the stated target
  (GoGo-BE#154), so `src/shared/api/realtime/` defines the room event set, an
  invalidation table keyed by event, and a transport interface. Screens call
  `useRoomRealtime(roomId, phase)` and declare which phase they are showing; no
  data hook accepts a `refetchInterval`, so cadence cannot leak into a screen.
  Adding SSE means writing a second transport and nothing else.

## Contract defects found and handled

1. **Duplicate `operationId: getPlaceImport`** on `GET /places/imports/{importId}`
   and `GET /cms/place-imports/{jobId}` produced an invalid `operations`
   interface — two identical keys — breaking codegen for *every* consumer. The
   CMS operation is now `getPlaceImportJob` (`GoGo-BE` #144). Re-vendor the spec
   with `pnpm api:types` after pulling a new `GoGo-BE` develop.
2. **`TokenGrant.expiresIn` is marked required but guest renewal omits it.** The
   client falls back to the server's default 900s TTL rather than computing an
   expiry from `undefined`.
3. **~15 consumer operations declare a 200 with a description but no schema**
   (`PATCH /me`, `PUT /me/device-tokens`, `POST …/stops/{stopId}/complete`, the
   saved-item writes, …). These generate as `never`; `OpResponse` maps them to
   `void`. `GET /places/imports/{importId}` is the one case whose body we
   actually read, so its shape is declared locally in `endpoints/places.ts` —
   delete that type once the spec declares one.
4. **`PlaceDetail` is snake_case** while every other DTO is camelCase, and
   declares no required fields. Screens must treat every field as optional.
5. **`GET /rooms/{roomId}/suggestions/current` omits `decisionMode`** when no run
   exists — "no run yet" is an empty state, not an error.
