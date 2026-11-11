import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { themes } from '../theme'
import { darkSurface, motion, overlay } from '../tokens'

// Audited form owners, including forms inside sheets. Keep this inventory when
// adding a submit/save/send flow; local-only wizard navigation has no mutation.
// Owner #625: AI chat sends are not form submissions; their pending state stays in chat.
const submitScreens = {
  'auth/sign-in': 'pending', // sign-in + sign-up
  'auth/forgot-password': 'pending',
  'auth/reset-password': 'complete.isPending',
  'tabs/profile': 'signingOut',
  'account/account': "saving || avatarStep === 'removing' || busy !== null",
  'account/avatar-editor': 'busy',
  'account/profile-defaults': 'blocking',
  'account/theme-accent': 'saving',
  'create-date/create-mood': 'createRoom.isPending',
  'create-date/save-draft': 'saving',
  'create-date/wizard-actions': 'leaving',
  'gogo-room/join-by-code': 'pending',
  'gogo-room/guest-join': 'pending',
  'home/quick-join': 'pending',
  'gogo-room/room-title-editor': 'rename.isPending',
  'gogo-room/room-schedule-editor': 'update.isPending',
  'gogo-room/room-manage': 'updateConstraints.isPending || transitionRoom.isPending || removeMember.isPending || removeSeedPlace.isPending || revokeInvite.isPending',
  'gogo-room/gogo-room': 'startMatching.isPending || createInvite.isPending || revokeInvite.isPending',
  'matching/preference': 'pending',
  'matching/match-result': 'finalize.isPending || regenerate.isPending',
  'review/review': 'createReview.isPending',
  'review/my-reviews': 'updateReview.isPending',
  'place-import/import': "state.phase === 'submitting' || resolve.isPending",
  'place-import/contribution-wizard': "state.phase === 'saving'", // also used for supplements
  'active-date/checkin-sheet': 'Boolean(pending)',
  'active-date/active-date': 'completeStop.isPending',
  'date-plan/plan-edit': 'editStops.isPending',
  'date-plan/date-plan': 'startDate.isPending || regenerate.isPending',
  'date-plan/place-report': 'report.isPending',
  'notifications/notification-settings': 'save.isPending',
  'notifications/notification-switch': 'save.isPending',
  'tabs/saved-link': 'pending',
  'assistant/history': 'saving',
  'assistant/assistant-reply': 'confirm.isPending || dismiss.isPending',
} as const

const source = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')

describe('submit overlay coverage', () => {
  it.each(Object.entries(submitScreens))('%s uses the shared overlay for its submit lifetime', (screen, pending) => {
    const text = source(`../../../features/${screen}.view.tsx`)
    const ast = ts.createSourceFile(screen, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const bindings: string[] = []
    function visit(node: ts.Node) {
      if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === 'BlockingLoadingOverlay') {
        const visible = node.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(ast) === 'visible')
        if (visible && ts.isJsxAttribute(visible) && visible.initializer && ts.isJsxExpression(visible.initializer)) {
          bindings.push(visible.initializer.expression?.getText(ast) ?? '')
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(ast)
    expect(text).toContain("from '@/shared/ui/blocking-loading-overlay.view'")
    expect(bindings).toContain(pending)
  })

  it.each(Object.entries(themes))('%s submit backdrop is the dark canvas at exactly 85 percent', (_name, theme) => {
    const channels = darkSurface.canvas.slice(1).match(/../g)!.map(channel => parseInt(channel, 16))
    expect(theme.overlay.submit).toBe(`rgba(${channels.join(',')},0.85)`)
    expect(theme.overlay.submit).toBe(overlay.submit)
  })

  it('keeps overlay paint in a theme role and the approved animation periods', () => {
    expect(source('../blocking-loading-overlay.style.tsx')).toContain('backgroundColor: theme.overlay.submit')
    expect(motion.loadingBeam).toBe(2400)
    expect(motion.loadingBounce).toBe(2000)
  })
})
