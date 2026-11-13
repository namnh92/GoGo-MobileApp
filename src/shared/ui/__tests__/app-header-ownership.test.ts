import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const src = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const features = resolve(src, 'features')
const read = (file: string) => readFileSync(resolve(features, file), 'utf8')
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(resolve(directory, entry.name)) : [resolve(directory, entry.name)])
}

// Direct owners plus the wrappers below cover every existing application nav bar.
// Headerless full-screen scenes, sheets and content headings are inventoried in issue-535.md.
const direct = [
  'account/account', 'active-date/active-date', 'assistant/assistant-header',
  'auth/forgot-password', 'auth/reset-password', 'auth/sign-in',
  'contributions/my-contributions', 'contributions/submission-detail', 'create-date/wizard-step', 'credits/credits', 'date-plan/date-plan',
  'date-plan/place-detail', 'date-plan/plan-change', 'date-plan/plan-edit',
  'gogo-room/gogo-room', 'gogo-room/guest-join', 'gogo-room/join-by-code', 'gogo-room/room-manage',
  'home/home', 'matching/preference', 'matching/swipe', 'notifications/notifications', 'notifications/notification-settings',
  'place-import/import', 'review/my-reviews', 'review/review', 'search/search',
  'settings/settings-page', 'tabs/plans', 'tabs/profile', 'tabs/saved', 'tabs/saved-city',
]
const wrappers: Record<string, string> = {
  'account/defaults-screen': 'SettingsPage', 'account/profile-defaults': 'SettingsPage', 'account/theme-screen': 'SettingsPage',
  'settings/permissions': 'SettingsPage',
  'assistant/assistant': 'AssistantHeader', 'assistant/history': 'AssistantHeader',
}
// SettingsPage covers permissions/data, defaults and theme, including embedded settings.
const profileHeaders = ['credits/credits', 'account/account', 'contributions/my-contributions', 'notifications/notifications', 'notifications/notification-settings', 'review/my-reviews', 'settings/settings-page']
function owns(source: string, name: string) {
  const ast = ts.createSourceFile('screen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let found = false
  function visit(node: ts.Node) {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(ast) === name) found = true
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return found
}

/** Scan actual JSX/ES imports so comments cannot satisfy or trip enforcement. */
function violations(file: string, source: string) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const errors: string[] = []
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) && /header-notification-button|back-header/.test(node.moduleSpecifier.getText(ast))) errors.push('standalone navigation import')
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(ast)
      const attrs = node.attributes.getText(ast)
      if (tag === 'AppHeader') {
        const props = node.attributes.properties
        if (props.some(prop => ts.isJsxAttribute(prop) && prop.name.getText(ast) === 'titleAlign')) errors.push('header alignment override')
        const inProfile = profileHeaders.some(screen => file.endsWith(`${screen}.view.tsx`))
        const notifications = props.find(prop => ts.isJsxAttribute(prop) && prop.name.getText(ast) === 'showNotifications')
        if (inProfile && (!notifications || !ts.isJsxAttribute(notifications) || !notifications.initializer || !ts.isJsxExpression(notifications.initializer) || notifications.initializer.expression?.kind !== ts.SyntaxKind.FalseKeyword)) errors.push('profile header must omit notification navigation')
        const inAssistant = file.endsWith('assistant/assistant-header.view.tsx')
        const inSheet = file.endsWith('administrative/administrative-picker.view.tsx')
        const variant = props.find(prop => ts.isJsxAttribute(prop) && prop.name.getText(ast) === 'variant')
        if (inAssistant && (!variant || !ts.isJsxAttribute(variant) || !variant.initializer || !ts.isStringLiteral(variant.initializer) || variant.initializer.text !== 'sub-screen' || !notifications || !ts.isJsxAttribute(notifications) || !notifications.initializer || !ts.isJsxExpression(notifications.initializer) || notifications.initializer.expression?.kind !== ts.SyntaxKind.FalseKeyword)) errors.push('assistant sub-screen header must omit notification navigation')
        if (inSheet && (!variant || !ts.isJsxAttribute(variant) || !variant.initializer || !ts.isStringLiteral(variant.initializer) || variant.initializer.text !== 'sheet')) errors.push('sheet header must omit notification navigation')
      }
      // Exempt only the measured intro controls, never the entire feature file.
      let parent: ts.Node | undefined = node.parent
      let introControls = false
      for (; parent; parent = parent.parent) {
        if (file.endsWith('onboarding/onboarding.view.tsx') && ts.isJsxElement(parent) && /testID="onboarding-header"/.test(parent.openingElement.getText(ast))) introControls = true
      }
      if (tag === 'BackHeader' || tag === 'HeaderNotificationButton' || tag === 'IconChevronLeft') errors.push(tag)
      const calendarPrevious = file.endsWith('create-date/date-time-sheet.view.tsx') && /createTime.prevMonth/.test(node.parent.parent?.getText(ast) ?? '')
      if (!introControls && !calendarPrevious && /^(Icon|MaterialIcon)/.test(tag) && /name=["'](?:arrowBack|chevronLeft)["']/.test(attrs)) errors.push('local back icon')
      if (!introControls && (tag === 'Pressable' || tag === 'IconBtn') && /accessibilityLabel=\{t\(['"]common.back['"]\)\}/.test(attrs)) errors.push('local navigation back button')
      if (/^(View|Animated.View)$/.test(tag) && /styles\.(pageHeader|navBar|topBar)\b/.test(attrs)) errors.push('local navigation bar style')
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return errors
}

describe('application header ownership', () => {
  it.each(direct)('%s renders the shared header', file => {
    const source = read(`${file}.view.tsx`)
    expect(owns(source, 'AppHeader')).toBe(true)
    expect(source).toContain("from '@/shared/ui/app-header.view'")
  })
  it.each(Object.entries(wrappers))('%s uses its shared header wrapper', (file, wrapper) => {
    expect(owns(read(`${file}.view.tsx`), wrapper)).toBe(true)
  })
  it('accounts for every routed feature screen, including deliberate headerless scenes', () => {
    const headerless = [
      // The /create layout owns WizardStep; nested screens own content only.
      'create-date/create-type-entry',
      'create-date/create-type', 'create-date/group-setup', 'create-date/create-time',
      'create-date/create-budget', 'create-date/create-mood',
      'create-date/create-location', // compatibility redirect to step 1
      'onboarding/splash', 'onboarding/onboarding', 'deep-link/share-link',
      'active-date/date-finished', 'matching/matching', 'matching/match-result',
      'review/shared-result', 'date-plan/place-reviews-page',
    ]
    const known = new Set([...direct, ...Object.keys(wrappers), ...headerless])
    const unknown = files(resolve(src, 'app')).filter(file => file.endsWith('.tsx')).flatMap(file => {
      const source = readFileSync(file, 'utf8')
      const match = source.match(/export\s+\{[^}]*default[^}]*\}\s+from ['"]@\/features\/(.+)\.view['"]/)
      return match && !known.has(match[1]) ? [match[1]] : []
    })
    expect(unknown).toEqual([])
  })
  it('keeps wizard chrome in the parent layout outside the content stack', () => {
    const layout = readFileSync(resolve(src, 'app/create/_layout.tsx'), 'utf8')
    expect(owns(layout, 'WizardStep')).toBe(true)
    expect(owns(layout, 'Stack')).toBe(true)
    expect(owns(read('create-date/wizard-step.view.tsx').split('export function WizardScreen')[1], 'WizardStep')).toBe(false)
    for (const step of ['create-type', 'group-setup', 'create-time', 'create-budget', 'create-mood']) {
      expect(owns(read(`create-date/${step}.view.tsx`), 'WizardScreen')).toBe(true)
      expect(owns(read(`create-date/${step}.view.tsx`), 'WizardStep')).toBe(false)
    }
  })
  it('keeps the shared sign-in/sign-up header free of account and notification actions', () => {
    const source = read('auth/sign-in.view.tsx')
    const ast = ts.createSourceFile('auth.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const headers: ts.JsxAttributes[] = []
    function visit(node: ts.Node) {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(ast) === 'AppHeader') headers.push(node.attributes)
      ts.forEachChild(node, visit)
    }
    visit(ast)
    expect(headers).toHaveLength(1)
    expect(headers[0].getText(ast)).toContain('showNotifications={false}')
    expect(headers[0].properties.some(prop => ts.isJsxAttribute(prop) && prop.name.getText(ast) === 'rightAction')).toBe(false)
    expect(owns(source, 'AvatarCircle')).toBe(false)
  })
  it('rejects screen-owned navigation throughout features', () => {
    const found = files(features).filter(file => file.endsWith('.view.tsx')).flatMap(file => {
      return violations(file, readFileSync(file, 'utf8')).map(error => `${file}: ${error}`)
    })
    expect(found).toEqual([])
  })
  it.each([
    resolve(src, 'shared/administrative/administrative-picker.view.tsx'),
    resolve(features, 'assistant/assistant-header.view.tsx'),
  ])('%s enforces its variant and excludes notification navigation', file => {
    const source = readFileSync(file, 'utf8')
    expect(owns(source, 'AppHeader')).toBe(true)
    expect(violations(file, source)).toEqual([])
  })
  it.each(profileHeaders)('%s enforces no bell on every profile sub-screen header', file => {
    const source = read(`${file}.view.tsx`)
    expect(owns(source, 'AppHeader')).toBe(true)
    expect(violations(`${file}.view.tsx`, source)).toEqual([])
    expect(violations(`${file}.view.tsx`, 'const x = <AppHeader title="T" />')).toEqual(['profile header must omit notification navigation'])
    expect(violations(`${file}.view.tsx`, 'const x = <AppHeader showNotifications={true} title="T" />')).toEqual(['profile header must omit notification navigation'])
  })
  it.each(['settings/permissions', 'account/defaults-screen', 'account/profile-defaults', 'account/theme-screen'])('%s inherits the bell-free settings header', file => {
    expect(owns(read(`${file}.view.tsx`), 'SettingsPage')).toBe(true)
  })
  it('rejects sheet navigation and per-screen title alignment overrides', () => {
    const source = 'const x = <AppHeader title="T" />'
    for (const file of ['administrative/administrative-picker.view.tsx']) {
      expect(violations(file, source)).toEqual(['sheet header must omit notification navigation'])
      expect(violations(file, source.replace('<AppHeader ', '<AppHeader variant="sheet" '))).toEqual([])
      expect(violations(file, source.replace('<AppHeader ', '<AppHeader variant="sub-screen" '))).toEqual(['sheet header must omit notification navigation'])
    }
    const assistant = 'assistant/assistant-header.view.tsx'
    expect(violations(assistant, source)).toEqual(['assistant sub-screen header must omit notification navigation'])
    expect(violations(assistant, '<AppHeader variant="sub-screen" showNotifications={false} title="T" />')).toEqual([])
    expect(violations(assistant, '<AppHeader variant="sub-screen" showNotifications={true} title="T" />')).toEqual(['assistant sub-screen header must omit notification navigation'])
    expect(violations(assistant, '<AppHeader variant="sheet" showNotifications={false} title="T" />')).toEqual(['assistant sub-screen header must omit notification navigation'])
    expect(violations('screen.view.tsx', 'const x = <AppHeader title="T" titleAlign="center" />')).toEqual(['header alignment override'])
  })
  it('cannot be bypassed with an extra shared header or a comment', () => {
    expect(violations('onboarding/onboarding.view.tsx', 'const x = <HeaderNotificationButton />')).toEqual(['HeaderNotificationButton'])
    expect(owns('// <AppHeader />\nconst x = <Text />', 'AppHeader')).toBe(false)
    expect(violations('screen.tsx', 'const x = <><AppHeader title="T" /><View style={styles.topBar}><Icon name="chevronLeft" /><HeaderNotificationButton /></View></>')).toEqual(['local navigation bar style', 'local back icon', 'HeaderNotificationButton'])
  })
})
