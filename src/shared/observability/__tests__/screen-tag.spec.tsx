import * as Sdk from '@sentry/react-native'
import { router, Stack } from 'expo-router'
import { act, renderRouter } from 'expo-router/testing-library'
import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { Text } from 'react-native'

import { initSentry, isScreenTemplate, redactText, resetSentryForTests, setSentryScreen } from '../sentry'
import { SentryScreenTag, screenTemplate } from '../screen-tag.view'

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
const DSN = 'https://0123456789abcdef0123456789abcdef@o0.ingest.us.sentry.io/1'

beforeEach(() => {
  resetSentryForTests()
  sdk.resetScopesForTests()
  jest.clearAllMocks()
})

function enable() {
  initSentry({ dsn: DSN, environment: 'dev' })
}

/** What reached the guarded scopes for `screen`, in order. */
function screens(): unknown[] {
  return [...sdk.isolationScope.forwarded, ...sdk.globalScope.forwarded]
    .filter(([name, key]) => name === 'setTag' && key === 'screen')
    .map(([, , value]) => value)
}

function app() {
  return {
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
  }
}

describe('SentryScreenTag', () => {
  it('tags the launch screen as `/` and every screen after it by its template', async () => {
    enable()
    await renderRouter(app(), { initialUrl: '/' })
    expect(screens()).toEqual(['/'])

    await act(async () => router.push(`/room/${CODE}/preference`))
    await act(async () => router.push(`/r/${CODE}`))
    await act(async () => router.push('/(tabs)'))
    expect(screens()).toEqual(['/', '/room/[roomId]/preference', '/r/[inviteCode]', '/(tabs)'])
  })

  it('never forwards the code in the pathname, to the JS scope or the native copy', async () => {
    enable()
    await renderRouter(app(), { initialUrl: `/r/${CODE}` })
    await act(async () => router.push(`/room/${CODE}/preference`))
    const everything = JSON.stringify([...sdk.isolationScope.forwarded, ...sdk.globalScope.forwarded])
    expect(everything).not.toContain(CODE)
    expect(screens()).toEqual(['/r/[inviteCode]', '/room/[roomId]/preference'])
  })

  it('does nothing while Sentry is off', async () => {
    await renderRouter(app(), { initialUrl: `/r/${CODE}` })
    expect(sdk.isolationScope.forwarded).toEqual([])
    expect(screens()).toEqual([])
  })
})

describe('setSentryScreen', () => {
  // D-7 addition 3: a value that is not a template never leaves as a path.
  it('sends `unknown` for anything that is not a route template', () => {
    enable()
    setSentryScreen(`/room/${CODE}/preference`)
    setSentryScreen(`/r/${CODE}`)
    setSentryScreen('/places/5f1c2a3e-1234-4abc-8def-0123456789ab')
    setSentryScreen('/room/[roomId]?tab=1')
    setSentryScreen('room/[roomId]')
    setSentryScreen('')
    expect(screens()).toEqual(['unknown', 'unknown', 'unknown', 'unknown', 'unknown', 'unknown'])
  })

  it('keeps a template as it is', () => {
    enable()
    for (const template of ['/', '/(tabs)', '/+not-found', '/create/group-setup', '/r/[inviteCode]']) {
      setSentryScreen(template)
    }
    expect(screens()).toEqual(['/', '/(tabs)', '/+not-found', '/create/group-setup', '/r/[inviteCode]'])
  })
})

/** Every route of the app, as `useSegments()` names it: file names, `index` dropped. */
function routeTemplates(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return routeTemplates(full, base)
    if (!/\.tsx?$/.test(name) || name.startsWith('_') || name === '+native-intent.tsx') return []
    const segments = path.relative(base, full).replace(/\.tsx?$/, '').split(path.sep)
    if (segments[segments.length - 1] === 'index') segments.pop()
    return [screenTemplate(segments)]
  })
}

describe('route templates', () => {
  const templates = routeTemplates(path.resolve(__dirname, '../../../app')).sort()

  it('finds the app routes', () => {
    expect(templates).toEqual(expect.arrayContaining(['/', '/(tabs)', '/r/[inviteCode]', '/l/[slug]', '/+not-found']))
  })

  // A new route whose name a redaction stage would rewrite fails here, not in Discord.
  it.each(templates.map(t => [t]))('%s survives the redactor unchanged and is sent as itself', template => {
    expect(redactText(template)).toBe(template)
    expect(isScreenTemplate(template)).toBe(true)
  })
})
