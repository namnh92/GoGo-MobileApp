import { useSegments } from 'expo-router'
// Internal paths, pinned by `screen-tag.spec.tsx` (the suite fails to load
// when a release moves them): the navigation container expo-router owns, and
// the derivation `useSegments()` itself is fed from, so both paths below name
// a screen the same way.
import { getRouteInfoFromState } from 'expo-router/build/global-state/routeInfo'
import { store } from 'expo-router/build/global-state/router-store'
import { useEffect } from 'react'

import { setScreenReader, setSentryScreen } from './sentry'

/**
 * The route template of the screen on top, as expo-router names it:
 * `/room/[roomId]/preference`, `/(tabs)/plans`, `/` for the launch screen (the
 * one route with no segments). The pathname, which carries the room or invite
 * code, is never read. Whether the value is one the app declares is decided in
 * `sentry.ts`, the reporting boundary (ADR-0011 D-12) — not here.
 */
export function screenTemplate(segments: readonly string[]): string {
  return `/${segments.join('/')}`
}

type Container = NonNullable<(typeof store.navigationRef)['current']>

/**
 * The container's handle, held from the last time the ref carried one. The ref
 * is a proxy that answers nothing while its handle is detached — and React
 * detaches it in the mutation phase of a commit that re-attaches it in the
 * layout phase, after a descendant boundary's `componentDidCatch` has run.
 * The commit that mounts the root boundary's fallback is one; the handle it
 * detached still reads the container's live state (measured, probe saved
 * with PR #349's evidence), so the reader keeps it.
 */
let container: Container | null = null

function holdContainer(): Container | null {
  // `store.navigationRef` is unset until the router's root has rendered once.
  container = store.navigationRef?.current ?? container
  return container
}

/**
 * The screen the navigation container holds at this moment, or `null` before
 * it has any state. The container's state moves when a navigation is
 * dispatched, before the new screen renders — unlike `useSegments()`, which
 * the router updates from the container's `state` event, one commit after the
 * screen mounted — so a JS event captured while a screen renders or mounts
 * names that screen (ADR 0010). It is the raw container state: a cold link's
 * nested routes and a push's `screen` param are in it before the nested
 * navigator has pushed its own state up (measured in `screen-tag.spec.tsx`).
 * A `?screen=` suffix the derivation appends is no template and is admitted
 * as `unknown` downstream, as on the scope path.
 *
 * Before the first commit has completed no handle exists (a throw in the first
 * screen's render or `componentDidMount` is the case): the router's own
 * `store.state` is then the initial state it derived from the launch URL,
 * before anything rendered — a cold link's screen, or nothing (`/`). After
 * that the handle is always held; the store's copy, which the router refreshes
 * from the post-commit `state` event, is never read again.
 *
 * `null` means one thing only: no navigator state exists yet, and the scope's
 * seeded `/` is the right answer. A state that exists but cannot be read or
 * named — `getRouteInfoFromState` refuses a shape it does not know, as it
 * would after an incompatible expo-router change — is a *failure* and is
 * **thrown**, not swallowed (Astra F-05, PR #230): the scope may hold the
 * previous screen, and a `null` here would let the event inherit it with no
 * sign that the read failed. What a failure is sent as is decided in
 * `sentry.ts`, the reporting boundary.
 */
function navigatorScreen(): string | null {
  const state = holdContainer()?.getState() ?? store.state
  if (!state) return null
  return screenTemplate(getRouteInfoFromState(state).segments)
}

// At module evaluation, so the reader exists before any screen renders and is
// never removed: an unmount cleanup would run in the mutation phase, before
// the boundary's `componentDidCatch` reads it — exactly when it is needed.
setScreenReader(navigatorScreen)

/**
 * GoGo-MobileApp#341 — the native path of the `screen` tag. Renders nothing;
 * mounted once in the root layout, before the navigator. Writes the settled
 * screen to the scope from an effect, after the router has published the new
 * segments: one commit after the new screen mounted. The SDK copies the scope
 * to native, and a native crash — which cannot run JS — carries whatever the
 * native scope last held; until the first effect that is the launch screen
 * `/`, seeded by `initSentry`. JS events do not wait for this write: they
 * read `navigatorScreen` at capture (ADR 0010).
 */
export function SentryScreenTag() {
  const template = screenTemplate(useSegments())
  useEffect(() => {
    // Every settled navigation is a commit in which the ref carries its handle: take it for the reader.
    holdContainer()
    setSentryScreen(template)
  }, [template])
  return null
}
