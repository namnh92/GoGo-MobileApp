import * as Sdk from '@sentry/react-native'
import * as Linking from 'expo-linking'
import { router, Stack } from 'expo-router'
import { act, renderRouter } from 'expo-router/testing-library'
import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { Component, useEffect, useLayoutEffect } from 'react'
import { Text } from 'react-native'

import { redirectSystemPath } from '@/app/+native-intent'

import { initSentry, isScreenTemplate, redactText, resetSentryForTests, setSentryScreen } from '../sentry'
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
const sdk = Sdk as unknown as { isolationScope: FakeScope; globalScope: FakeScope; resetScopesForTests: () => void }

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

  // Sol F-02 (PR #349): measured on the writer itself, not assumed. The root
  // layout re-renders with the new segments after the new screen has mounted,
  // so the screen's mount handlers still see the previous tag; once the
  // navigation settles the tag is the new screen. The phase the writer runs in
  // (`useEffect` shipped, `useLayoutEffect` the proposed fix) does not change
  // that. Pinned so a change in expo-router's ordering is noticed (ADR 0010).
  it.each([
    ['useEffect', useEffect],
    ['useLayoutEffect', useLayoutEffect],
  ])('with a %s writer: the previous screen during the new screen mount, its own once settled', async (_name, useWriteEffect) => {
    enable()
    const atMount: unknown[] = []
    const latest = () => screens()[screens().length - 1]
    function HookScreen() {
      useLayoutEffect(() => {
        atMount.push(latest())
      }, [])
      return <Text>preference</Text>
    }
    class ClassScreen extends Component {
      componentDidMount() {
        atMount.push(latest())
      }
      render() {
        return <Text>join</Text>
      }
    }
    await renderRouter(
      {
        ...app(),
        _layout: () => (
          <>
            <SentryScreenTag useWriteEffect={useWriteEffect} />
            <Stack />
          </>
        ),
        'room/[roomId]/preference': HookScreen,
        'r/[inviteCode]': () => <ClassScreen />,
      },
      { initialUrl: '/' },
    )
    await act(async () => router.push(`/room/${CODE}/preference`))
    expect(latest()).toBe('/room/[roomId]/preference')
    await act(async () => router.push(`/r/${CODE}`))
    expect(latest()).toBe('/r/[inviteCode]')
    expect(atMount).toEqual(['/', '/room/[roomId]/preference'])
  })

  it('does nothing while Sentry is off', async () => {
    await renderRouter(app(), { initialUrl: `/r/${CODE}` })
    expect(sdk.isolationScope.forwarded).toEqual([])
    expect(screens()).toEqual([])
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
