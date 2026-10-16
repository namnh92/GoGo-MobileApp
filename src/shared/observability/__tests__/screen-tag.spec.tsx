import * as Sdk from '@sentry/react-native'
import * as Linking from 'expo-linking'
import { router, Stack } from 'expo-router'
import { act, renderRouter } from 'expo-router/testing-library'
import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import type { ErrorEvent } from '@sentry/react-native'
import { Component, useEffect, useLayoutEffect, type ReactNode } from 'react'
import { Text } from 'react-native'

import { redirectSystemPath } from '@/app/+native-intent'

import {
  beforeSend,
  captureError,
  initSentry,
  isScreenTemplate,
  redactText,
  resetSentryForTests,
  setSentryScreen,
} from '../sentry'
import { SentryScreenTag, screenTemplate } from '../screen-tag.view'
import { SCREEN_TEMPLATES } from '../screen-templates'

/**
 * GoGo-MobileApp#341 — the `screen` tag is the route template, never the
 * pathname. These run the shipped component inside expo-router's real
 * navigator; only the SDK is the jest stand-in, whose scopes record what
 * `sentry.ts` forwards (and so what the native SDKs would receive).
 */

// expo-router's matcher module imports `expect/build/matchers`, which this jest
// cannot load (as in notification-click.spec.tsx).
jest.mock('expo-router/build/testing-library/expect', () => ({}))

type FakeScope = { forwarded: [string, ...unknown[]][] }
const sdk = Sdk as unknown as {
  isolationScope: FakeScope
  globalScope: FakeScope
  resetScopesForTests: () => void
  captureException: jest.Mock
}

const CODE = 'YDi_00PB1z4FSQZjpLbgdw'
const UUID = '5f1c2a3e-1234-4abc-8def-0123456789ab'
const DSN = 'https://0123456789abcdef0123456789abcdef@o0.ingest.us.sentry.io/1'
/** The launch screen, seeded by `initSentry` before anything renders (Sol F-05, Astra A-F-03). */
const LAUNCH = '/'
const UNKNOWN = 'unknown'

beforeEach(() => {
  resetSentryForTests()
  sdk.resetScopesForTests()
  jest.clearAllMocks()
})

function enable() {
  initSentry({ dsn: DSN, environment: 'dev' })
}

/** Everything forwarded to both guarded scopes, as text. */
function forwarded(): string {
  return JSON.stringify([...sdk.isolationScope.forwarded, ...sdk.globalScope.forwarded])
}

/** What reached the guarded scopes for `screen`, in order. */
function screens(): unknown[] {
  return [...sdk.isolationScope.forwarded, ...sdk.globalScope.forwarded]
    .filter(([name, key]) => name === 'setTag' && key === 'screen')
    .map(([, , value]) => value)
}

/** The screens after the launch seed — what navigation wrote. */
function navigated(): unknown[] {
  expect(screens()[0]).toBe(LAUNCH)
  return screens().slice(1)
}

/** The shapes of the real tree: index directories, leaves with siblings, dynamic segments. */
function app() {
  return {
    '+native-intent': { redirectSystemPath },
    _layout: () => (
      <>
        <SentryScreenTag />
        <Stack />
      </>
    ),
    index: () => <Text>splash</Text>,
    '(tabs)/_layout': () => <Stack />,
    '(tabs)/index': () => <Text>home</Text>,
    '(tabs)/plans': () => <Text>plans</Text>,
    'r/[inviteCode]': () => <Text>join</Text>,
    'room/[roomId]/preference': () => <Text>preference</Text>,
    'plans/[planId]/index': () => <Text>plan</Text>,
    'plans/[planId]/active': () => <Text>active</Text>,
    'places/search': () => <Text>search</Text>,
    'places/import': () => <Text>import</Text>,
  }
}

describe('launch seed', () => {
  // Sol F-05 / Astra A-F-03 (PR #349): an error or native crash before the
  // first navigation effect — AppProviders throwing, the launch tree — carried
  // no tag, or on iOS the previous run's (the native scope persists). The
  // boundary seeds `/` the moment the SDK is on, with nothing rendered yet.
  it('tags `/` at init, before anything renders', () => {
    enable()
    expect(screens()).toEqual([LAUNCH])
  })

  it('seeds nothing while Sentry is off', () => {
    initSentry({ dsn: 'off', environment: 'dev' })
    expect(sdk.isolationScope.forwarded).toEqual([])
  })

  // First in the file on purpose: the router keeps its state for the life of
  // the process, so "no navigator state yet" exists only before the first
  // `renderRouter` — as in the app, only before the first commit.
  it('an error before any navigator state exists carries the seeded launch screen', () => {
    enable()
    captureError(new Error('providers failed'), { kind: 'boundary' })
    expect(sentScreen()).toBe(LAUNCH)
  })
})

describe('SentryScreenTag', () => {
  it('tags the launch screen as `/` and every screen after it by its template', async () => {
    enable()
    await renderRouter(app(), { initialUrl: '/' })
    expect(navigated()).toEqual(['/'])

    await act(async () => router.push(`/room/${CODE}/preference`))
    await act(async () => router.push(`/r/${CODE}`))
    await act(async () => router.push('/(tabs)'))
    expect(navigated()).toEqual(['/', '/room/[roomId]/preference', '/r/[inviteCode]', '/(tabs)'])
  })

  it('never forwards the code in the pathname, to the JS scope or the native copy', async () => {
    enable()
    await renderRouter(app(), { initialUrl: `/r/${CODE}` })
    await act(async () => router.push(`/room/${CODE}/preference`))
    expect(forwarded()).not.toContain(CODE)
    expect(navigated()).toEqual(['/r/[inviteCode]', '/room/[roomId]/preference'])
  })

  // Sol F-01 (PR #349): on a cold link Expo Router appends the `?screen=`
  // query value to the segments (`r,[inviteCode],<value>`); on a warm
  // `router.push` it drops the reserved key and the screen is its own template
  // (measured — the OS-link variants are the F-04 pins below). Either way the
  // value itself never reaches a scope.
  it.each([
    ['a uuid', UUID],
    ['a letters-only value', 'lettersonly'],
  ])('a link carrying ?screen= with %s: `unknown` when cold, the template when pushed, the value never', async (_label, value) => {
    enable()
    await renderRouter(app(), { initialUrl: `/r/${CODE}?screen=${value}` })
    await act(async () => router.push(`/room/${CODE}/preference?screen=${value}`))
    expect(forwarded()).not.toContain(value)
    expect(forwarded()).not.toContain(CODE)
    expect(navigated()).toEqual([UNKNOWN, '/room/[roomId]/preference'])
  })

  // Sol F-04 (PR #349): measured, not assumed. Expo Router appends the
  // `?screen=` value verbatim to a leaf's segments and keeps `index` on an
  // index-directory route, so `/plans/<id>?screen=active` is
  // `plans,[planId],index,active`, never `/plans/[planId]/active`. A link can
  // complete another template only through a non-index leaf template that is
  // a strict prefix of another — `route templates` below pins that none is.
  it.each([
    ['an index-directory route', `/plans/${UUID}?screen=active`, '/plans/[planId]/active'],
    ['a leaf', '/places/search?screen=import', '/places/import'],
  ])('cold link to %s with ?screen=<sibling> is `unknown`, never the sibling', async (_label, url, sibling) => {
    enable()
    await renderRouter(app(), { initialUrl: url })
    expect(screens()).not.toContain(sibling)
    expect(navigated()).toEqual([UNKNOWN])
  })

  it('warm system link (the OS `url` event, through +native-intent) with ?screen= is `unknown`', async () => {
    enable()
    const spy = jest.spyOn(Linking, 'addEventListener')
    await renderRouter(app(), { initialUrl: '/' })
    const onUrl = spy.mock.calls.filter(([event]) => event === 'url').at(-1)?.[1] as
      | ((event: { url: string }) => Promise<void>)
      | undefined
    expect(onUrl).toBeDefined()
    for (const url of [`https://go-dev.gogo.id.vn/plans/${UUID}?screen=active`, 'gogo-dev://places/search?screen=import']) {
      await act(async () => {
        await onUrl!({ url })
      })
    }
    expect(screens()).not.toContain('/plans/[planId]/active')
    expect(screens()).not.toContain('/places/import')
    expect(forwarded()).not.toContain(UUID)
    expect(navigated()).toEqual(['/', UNKNOWN, UNKNOWN])
    spy.mockRestore()
  })

  it('does nothing while Sentry is off', async () => {
    await renderRouter(app(), { initialUrl: `/r/${CODE}` })
    expect(sdk.isolationScope.forwarded).toEqual([])
    expect(screens()).toEqual([])
  })
})

type Phase = 'render' | 'useLayoutEffect' | 'componentDidMount' | 'useEffect'

function Throws({ message }: { message: string }): never {
  throw new Error(message)
}

/** A screen that throws once, in the given phase of its first mount. */
function failing(phase: Phase, label: string) {
  class DidMount extends Component<{ children: ReactNode }> {
    componentDidMount() {
      throw new Error(`${label} ${phase}`)
    }
    render() {
      return this.props.children
    }
  }
  return function Screen() {
    useLayoutEffect(() => {
      if (phase === 'useLayoutEffect') throw new Error(`${label} ${phase}`)
    }, [])
    useEffect(() => {
      if (phase === 'useEffect') throw new Error(`${label} ${phase}`)
    }, [])
    if (phase === 'render') return <Throws message={`${label} ${phase}`} />
    if (phase === 'componentDidMount') {
      return (
        <DidMount>
          <Text>{label}</Text>
        </DidMount>
      )
    }
    return <Text>{label}</Text>
  }
}

/** The root error boundary's shape: above the tag and the navigator, reports through `captureError`. */
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    captureError(error, { kind: 'boundary' })
  }
  render() {
    return this.state.failed ? <Text>failed</Text> : this.props.children
  }
}

function layoutWithBoundary() {
  return (
    <Boundary>
      <SentryScreenTag />
      <Stack />
    </Boundary>
  )
}

/**
 * The `screen` tag of the one JS event, as the SDK would send it: the scope's
 * value, the capture context's over it, then `beforeSend`. The jest stand-in
 * records the capture; the merge order is the SDK's.
 */
function sentScreen(): unknown {
  expect(sdk.captureException).toHaveBeenCalledTimes(1)
  const [error, context] = sdk.captureException.mock.calls[0] as [unknown, { tags?: Record<string, unknown> }]
  const event = { type: undefined, tags: { screen: screens().at(-1), ...context.tags } } as unknown as ErrorEvent
  return beforeSend(event, { originalException: error })?.tags?.screen
}

/**
 * Sol F-02 / Astra F-04 (PR #349), owner 2026-10-16: an error reported while
 * the new screen renders or mounts carries that screen. The root layout learns
 * the new segments one commit after the screen mounted, so the scope still
 * holds the previous screen then — and once the boundary has caught the error
 * the navigator is gone and the scope never learns it. A JS event therefore
 * reads the screen from the navigation container's state at capture (ADR
 * 0010); these go through a boundary, the shape the root layout has.
 */
describe('a JS event carries the screen the navigator holds at capture', () => {
  const PREFERENCE = '/room/[roomId]/preference'
  let consoleError: jest.SpyInstance
  beforeEach(() => {
    // React logs every caught error; the tag is the point here.
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => consoleError.mockRestore())

  it.each<Phase>(['render', 'useLayoutEffect', 'componentDidMount', 'useEffect'])(
    'a throw in %s of the new screen is tagged with that screen, not the previous one',
    async phase => {
      enable()
      await renderRouter(
        { ...app(), _layout: layoutWithBoundary, 'room/[roomId]/preference': failing(phase, 'preference') },
        { initialUrl: '/places/search' },
      )
      expect(navigated()).toEqual(['/places/search'])
      await act(async () => router.push(`/room/${CODE}/preference`))
      // The scope still names the previous screen: only the event-local read can name the new one.
      expect(navigated()).toEqual(['/places/search'])
      expect(sentScreen()).toBe(PREFERENCE)
      expect(JSON.stringify(sdk.captureException.mock.calls)).not.toContain(CODE)
      expect(forwarded()).not.toContain(CODE)
    },
  )

  // A nested navigator's first commit: the container holds the tab group and
  // what the link or push named below it (expo-router's own derivation,
  // `getRouteInfoFromState`), before the tab navigator has pushed its state up.
  // Measured, not assumed — the ADR states the result.
  it.each<[string, Phase]>([
    ['render', 'render'],
    ['componentDidMount', 'componentDidMount'],
  ])('a throw in %s of a tab reached by a cold link, with the tab navigator mounting, is tagged with the tab', async (_label, phase) => {
    enable()
    await renderRouter(
      { ...app(), _layout: layoutWithBoundary, '(tabs)/plans': failing(phase, 'plans') },
      { initialUrl: '/(tabs)/plans' },
    )
    expect(sentScreen()).toBe('/(tabs)/plans')
  })

  it.each<[string, Phase]>([
    ['render', 'render'],
    ['componentDidMount', 'componentDidMount'],
  ])('a throw in %s of a tab reached by a push, with the tab navigator mounting, is tagged with the tab', async (_label, phase) => {
    enable()
    await renderRouter(
      { ...app(), _layout: layoutWithBoundary, '(tabs)/plans': failing(phase, 'plans') },
      { initialUrl: '/places/search' },
    )
    await act(async () => router.push('/(tabs)/plans'))
    expect(sentScreen()).toBe('/(tabs)/plans')
  })

  // A-10 on the capture path: a `?screen=` suffix the link appended is no template, so `unknown`, never the sibling.
  it('a throw in render of a cold-linked leaf with ?screen=<sibling> is tagged `unknown`, never the sibling', async () => {
    enable()
    await renderRouter(
      { ...app(), _layout: layoutWithBoundary, 'places/search': failing('render', 'search') },
      { initialUrl: '/places/search?screen=import' },
    )
    expect(sentScreen()).toBe(UNKNOWN)
  })

  it('reports nothing while Sentry is off', async () => {
    await renderRouter(
      { ...app(), _layout: layoutWithBoundary, 'room/[roomId]/preference': failing('render', 'preference') },
      { initialUrl: '/' },
    )
    await act(async () => router.push(`/room/${CODE}/preference`))
    expect(sdk.captureException).not.toHaveBeenCalled()
  })
})

/**
 * ADR-0011 D-12: admission is membership in the declared list, not shape. The
 * rows carry the ids of the ADR's rejection table; every one is sent as
 * `unknown`, and nothing of the input reaches a scope.
 */
const REJECTED: [string, string][] = [
  ['A-1', `/room/${CODE}/preference`],
  ['A-2', `/r/${CODE}`],
  ['A-3', `/places/${UUID}`],
  ['A-4', '/places/alice'],
  ['A-5', '/room/[roomId]?tab=1'],
  ['A-6', '/room/[roomId]#top'],
  ['A-7', 'room/[roomId]'],
  ['A-8', '/room/[roomId]/'],
  ['A-9', ''],
  ['A-10', '/room/[roomId]/preference/extra'],
  ['A-11', '/ROOM/[roomId]'],
]

describe('setSentryScreen', () => {
  it.each(REJECTED)('%s rejects %p: sent as `unknown`, input never forwarded', (_id, value) => {
    enable()
    setSentryScreen(value)
    expect(navigated()).toEqual([UNKNOWN])
    expect(isScreenTemplate(value)).toBe(false)
    if (value) expect(forwarded()).not.toContain(value)
  })

  it('keeps a declared template as it is', () => {
    enable()
    for (const template of ['/', '/(tabs)', '/+not-found', '/create/group-setup', '/r/[inviteCode]']) {
      setSentryScreen(template)
    }
    expect(navigated()).toEqual(['/', '/(tabs)', '/+not-found', '/create/group-setup', '/r/[inviteCode]'])
  })

  it('does nothing while Sentry is off', () => {
    setSentryScreen('/(tabs)')
    expect(sdk.isolationScope.forwarded).toEqual([])
  })
})

type RouteFile = { template: string; isIndex: boolean }

/** Every route of the app, as `useSegments()` names it: file names, `index` dropped. */
function routeFiles(dir: string, base = dir): RouteFile[] {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return routeFiles(full, base)
    // Exactly the two files that are not screens (Sol F-03): any other name is a route.
    if (!/\.tsx?$/.test(name) || /^(?:_layout|\+native-intent)\.tsx?$/.test(name)) return []
    const segments = path.relative(base, full).replace(/\.tsx?$/, '').split(path.sep)
    const isIndex = segments[segments.length - 1] === 'index'
    if (isIndex) segments.pop()
    return [{ template: screenTemplate(segments), isIndex }]
  })
}

describe('route templates', () => {
  const files = routeFiles(path.resolve(__dirname, '../../../app'))
  const templates = files.map(f => f.template).sort()

  it('is exactly the list the tag may send', () => {
    expect(templates).toEqual(expect.arrayContaining(['/', '/(tabs)', '/r/[inviteCode]', '/l/[slug]', '/+not-found']))
    expect(templates).toEqual([...SCREEN_TEMPLATES].sort())
  })

  // A new route whose name a redaction stage would rewrite fails here, not in Discord.
  it.each(templates.map(t => [t]))('%s survives the redactor unchanged and is sent as itself', template => {
    expect(redactText(template)).toBe(template)
    expect(isScreenTemplate(template)).toBe(true)
    expect(screenTemplate(template === '/' ? [] : template.slice(1).split('/'))).toBe(template)
  })

  // Sol F-04: the cold/warm pins above hold only while this does. Expo Router
  // appends a `?screen=` value verbatim to a leaf, so `a.tsx` (not
  // `a/index.tsx`) next to `a/b.tsx` would let `/a?screen=b` be tagged `/a/b`.
  // Adding such a route needs a new guard first, not a new entry in the list.
  it('no non-index leaf template is a strict prefix of another template', () => {
    const prefixes = files.filter(f => templates.some(t => t !== f.template && t.startsWith(f.template === '/' ? '/' : `${f.template}/`)))
    expect(prefixes.map(f => f.template).sort()).toEqual(['/', '/(tabs)', '/plans/[planId]', '/room/[roomId]'])
    expect(prefixes.filter(f => !f.isIndex)).toEqual([])
  })
})
