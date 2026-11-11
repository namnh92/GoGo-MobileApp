import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'

const src = resolve(__dirname, '../../..')
const read = (file: string) => readFileSync(resolve(src, file), 'utf8')
// Owner round 8: room and local draft presenters share one entity card.
const owners = ['features/tabs/plans.view.tsx', 'features/create-date/draft-plan-card.view.tsx']

it.each(owners)('%s renders the shared PlanCard', file => {
  expect(read(file)).toContain("from '@/shared/ui/plan-card.view'")
  expect(read(file)).toMatch(/<PlanCard\s/)
})

it('draft status and delete keep the shared neutral pill and warning confirmation', () => {
  const draft = read(owners[1])
  expect(draft).toContain("status={{ label: t('draft.status'), variant: 'default' }}")
  expect(draft).toContain('<ResultSheet')
  expect(draft).toContain('variant="warning"')
  expect(draft).not.toMatch(/<(?:Chip|Card|Pressable)\s/)
})

it('Home has no draft entry and the retired button block is absent', () => {
  expect(read('features/home/home.view.tsx')).not.toMatch(/DraftResume|DraftPlanCard/)
  expect(read(owners[0])).not.toContain('DraftResume')
  for (const suffix of ['view', 'style']) expect(existsSync(resolve(src, `features/create-date/draft-resume.${suffix}.tsx`))).toBe(false)
})
