import type { components } from '@/shared/api'
import type { MaterialIconName } from '@/shared/ui/material-icon'

type TaxonomyList = components['schemas']['TaxonomyList']
type Entry = NonNullable<TaxonomyList['kinds']>[string][number]
// GET currently exposes active entries only and no groups. Preserve optional
// group metadata when provided, without inventing client-owned categories.
export type ContributionOption = Entry & {
  key: string
  active?: boolean
  group?: string
}
export function taxonomyOptions(data: TaxonomyList | undefined, kind: string): ContributionOption[] {
  return ((data?.kinds?.[kind] ?? []) as ContributionOption[])
    .filter((entry) => !!entry.key && entry.active !== false)
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
}
export function optionLabel(option: ContributionOption, locale: string, fallback: string): string {
  return option.labels?.[locale]?.trim() || option.labels?.[locale.split('-')[0]!]?.trim() || fallback
}
/** Keep selected values visible, filling remaining slots in CMS order. */
export function collapsedOptions(options: ContributionOption[], selected: string[], limit: number) {
  const chosen = options.filter((option) => selected.includes(option.key))
  const fill = options.filter((option) => !selected.includes(option.key)).slice(0, Math.max(0, limit - chosen.length))
  const visible = new Set([...chosen, ...fill].map((option) => option.key))
  return options.filter((option) => visible.has(option.key))
}
const amenityIcons: Record<string, MaterialIconName> = {
  car_parking: 'parking', motorbike_parking: 'parking', power_outlets: 'power',
  power_at_each_table: 'power', pets_allowed: 'pets', separate_smoking_area: 'smoking',
  open_after_23: 'night', tables_over_six: 'groups', card_payment: 'payments', qr_payment: 'payments',
}
export function amenityIcon(key: string): MaterialIconName {
  return Object.hasOwn(amenityIcons, key) ? amenityIcons[key]! : 'activity'
}
