import type { TFunction } from 'i18next'

import type { AssistantProposal } from '@/shared/api'
import { formatMoney } from '@/shared/pricing/money'
import type { IconName } from '@/shared/ui/icons'

import { formatWhen } from './format'

/**
 * A proposal's values as `InfoRows` (GoGo-MobileApp#378). The contract sends
 * facts — `{ field, value, origin }` — and the card composes its own copy:
 * start and end become one "When" row, amount and mode one "Budget" row. A
 * value the assistant filled in (`origin: assumed`) carries "End time
 * assumed" until the person changes it. The same rows render the server's
 * saved values on the `TaskSummary`.
 */
export interface ProposalValueLike {
  field: string
  value: unknown
  origin?: 'explicit' | 'assumed'
  editable?: boolean
}

export type ProposalEdit =
  | { kind: 'time'; label: string }
  | { kind: 'budget'; label: string; hasMode: boolean }
  | { kind: 'text'; field: string; label: string }
  | { kind: 'choice'; field: string; label: string; options: { value: string; label: string }[] }

export interface ProposalRow {
  key: string
  icon: IconName
  label: string
  value: string
  /** "End time assumed" — shown until the person edits the value. */
  hint?: string
  edit?: ProposalEdit
}

export interface RowContext {
  t: TFunction
  locale: string
  /** Place names from the cards in the thread; a proposal carries only ids. */
  placeNames: ReadonlyMap<string, string>
  administrativeAreaLabel?: string
}

// Structured values must have an explicit presenter; never serialize API data into copy.
const str = (value: unknown) => (typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : '')

export function effectiveValues(values: ProposalValueLike[], edits: Record<string, unknown>): ProposalValueLike[] {
  return values.map(value =>
    value.field in edits ? { ...value, value: edits[value.field], origin: 'explicit' as const } : value,
  )
}

export function proposalRows(values: ProposalValueLike[], { t, locale, placeNames, administrativeAreaLabel }: RowContext): ProposalRow[] {
  const by = new Map(values.map(value => [value.field, value]))
  const rows: ProposalRow[] = []
  const take = (field: string) => by.get(field)
  const assumed = (value: ProposalValueLike | undefined) => value?.origin === 'assumed'

  const title = take('title')
  if (title) {
    rows.push({
      key: 'title',
      icon: 'bookmark',
      label: t('assistant.field.title'),
      value: str(title.value),
      ...(assumed(title) ? { hint: t('assistant.proposal.assumed', { field: t('assistant.field.title') }) } : {}),
      ...(title.editable ? { edit: { kind: 'text', field: 'title', label: t('assistant.field.title') } } : {}),
    })
  }

  const type = take('type')
  if (type) {
    rows.push({
      key: 'type',
      icon: 'users',
      label: t('assistant.field.type'),
      value: type.value === 'couple' ? t('assistant.value.couple') : type.value === 'group' ? t('assistant.value.group') : str(type.value),
      ...(assumed(type) ? { hint: t('assistant.proposal.assumed', { field: t('assistant.field.type') }) } : {}),
      ...(type.editable
        ? {
            edit: {
              kind: 'choice',
              field: 'type',
              label: t('assistant.field.type'),
              options: [
                { value: 'couple', label: t('assistant.value.couple') },
                { value: 'group', label: t('assistant.value.group') },
              ],
            },
          }
        : {}),
    })
  }

  const start = take('startAt')
  const end = take('endAt')
  if (start && typeof start.value === 'string') {
    const hint = assumed(start)
      ? t('assistant.proposal.assumed', { field: t('assistant.field.startTime') })
      : assumed(end)
        ? t('assistant.proposal.assumed', { field: t('assistant.field.endTime') })
        : undefined
    rows.push({
      key: 'when',
      icon: 'calendar',
      label: t('assistant.field.when'),
      value: formatWhen(start.value, typeof end?.value === 'string' ? end.value : null, locale),
      ...(hint ? { hint } : {}),
      ...(start.editable || end?.editable ? { edit: { kind: 'time', label: t('assistant.field.when') } } : {}),
    })
  }

  const place = take('placeId')
  if (place) {
    rows.push({
      key: 'place',
      icon: 'mapPin',
      label: t('assistant.field.place'),
      value: placeNames.get(str(place.value)) ?? t('assistant.value.selectedPlace'),
    })
  }

  const amount = take('budgetAmount')
  const mode = take('budgetMode')
  // #401 / core.md 13: zero is not a known budget. Keep both fields
  // consumed when the amount or scope is unknown, so neither leaks through
  // the generic field/JSON fallback below. This only changes presentation.
  if (
    amount && typeof amount.value === 'number'
    && Number.isSafeInteger(amount.value) && amount.value > 0
    && (mode?.value === 'per_person' || mode?.value === 'total')
  ) {
    const money = formatMoney(amount.value)
    rows.push({
      key: 'budget',
      icon: 'dollar',
      label: t('assistant.field.budget'),
      value:
        mode?.value === 'per_person'
          ? t('assistant.value.budgetPerPerson', { amount: money })
          : t('assistant.value.budgetTotal', { amount: money }),
      ...(assumed(amount) || assumed(mode)
        ? { hint: t('assistant.proposal.assumed', { field: t(assumed(amount) ? 'assistant.field.budget' : 'assistant.field.budgetMode') }) }
        : {}),
      ...(amount.editable || mode?.editable
        ? { edit: { kind: 'budget', label: t('assistant.field.budget'), hasMode: mode !== undefined } }
        : {}),
    })
  }

  const room = take('roomId')
  if (room) rows.push({ key: 'room', icon: 'home', label: t('assistant.field.room'), value: t('assistant.value.yourRoom') })

  const vote = take('value')
  if (vote) {
    rows.push({
      key: 'vote',
      icon: 'heart',
      label: t('assistant.field.vote'),
      value: vote.value === 'up' || vote.value === 'like' ? t('assistant.value.voteUp') : t('assistant.value.voteDown'),
    })
  }

  const area = take('areaKey')
  if (area) rows.push({ key: 'area', icon: 'map', label: t('assistant.field.area'), value: str(area.value) })

  const administrativeArea = take('administrativeArea')
  if (administrativeArea?.value != null) {
    rows.push({ key: 'administrativeArea', icon: 'map', label: t('assistant.field.area'), value: administrativeAreaLabel ?? t('assistant.value.areaUnavailable') })
  }
  const seeds = take('seedPlaceIds')
  if (Array.isArray(seeds?.value) && seeds.value.every(id => typeof id === 'string')) {
    rows.push({ key: 'seedPlaceIds', icon: 'mapPin', label: t('assistant.field.suggestedPlaces'), value: t('assistant.value.suggestedPlaces', { count: seeds.value.length }) })
  }
  // New contract fields need an explicit localized presenter before being displayed.
  return rows.filter(row => row.value !== '')
}

export function proposalTitle(proposal: Pick<AssistantProposal, 'kind' | 'values'>, t: TFunction): string {
  switch (proposal.kind) {
    case 'create_room': {
      const type = proposal.values.find(value => value.field === 'type')?.value
      return type === 'couple' ? t('assistant.audience.couple') : type === 'group' ? t('assistant.value.group') : t('assistant.proposal.title.newPlan')
    }
    case 'create_invite':
      return t('assistant.proposal.title.create_invite')
    case 'cast_vote':
      return t('assistant.proposal.title.cast_vote')
    case 'finalize_plan':
      return t('assistant.proposal.title.finalize_plan')
    default:
      return t('assistant.proposal.title.generic')
  }
}

export function confirmLabel(kind: string, t: TFunction): string {
  switch (kind) {
    case 'create_room':
      return t('assistant.proposal.confirm.create_room')
    case 'create_invite':
      return t('assistant.proposal.confirm.create_invite')
    case 'cast_vote':
      return t('assistant.proposal.confirm.cast_vote')
    case 'finalize_plan':
      return t('assistant.proposal.confirm.finalize_plan')
    default:
      return t('assistant.proposal.confirm.generic')
  }
}

export function doneLabel(kind: string, t: TFunction): string {
  switch (kind) {
    case 'create_room':
      return t('assistant.proposal.done.create_room')
    case 'create_invite':
      return t('assistant.proposal.done.create_invite')
    case 'cast_vote':
      return t('assistant.proposal.done.cast_vote')
    case 'finalize_plan':
      return t('assistant.proposal.done.finalize_plan')
    default:
      return t('assistant.proposal.done.generic')
  }
}

/** "20:00" → minutes, or null. */
export function parseClock(text: string): { hours: number; minutes: number } | null {
  const match = /^\s*(\d{1,2})[:.h](\d{2})\s*$/.exec(text)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  return hours < 24 && minutes < 60 ? { hours, minutes } : null
}

/** The same local day as `iso`, at `clock`. */
export function withClock(iso: string, clock: { hours: number; minutes: number }): string {
  const date = new Date(iso)
  date.setHours(clock.hours, clock.minutes, 0, 0)
  return date.toISOString()
}
