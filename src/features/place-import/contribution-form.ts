import { z } from 'zod'
import type { components } from '@/shared/api'

type Schemas = components['schemas']
export type EnrichmentDraft = Schemas['ContributionEnrichmentDraft']
export type Enrichment = Schemas['ContributionEnrichment']
export type ContributionDraft = Schemas['ContributionDraft']
export const amenityFields = [
  'car_parking',
  'power_at_each_table',
  'pets_allowed',
  'separate_smoking_area',
  'open_after_23',
  'tables_over_six',
] as const satisfies readonly (keyof NonNullable<EnrichmentDraft['amenities']>)[]
export const priceUnits = ['per_person', 'per_group', 'per_item', 'per_hour', 'per_night', 'free'] as const

export interface ContributionForm {
  priceKnown: boolean
  min: string
  max: string
  unit: (typeof priceUnits)[number]
  purposeKeys: string[]
  vibeKeys: string[]
  amenities: NonNullable<EnrichmentDraft['amenities']>
  recommendedDishes: string
  visitTips: string
  serviceRating: number
  serviceChips: string[]
  spaceRating: number
  spaceChips: string[]
}
export const emptyContribution = (): ContributionForm => ({
  priceKnown: false,
  min: '',
  max: '',
  unit: 'per_person',
  purposeKeys: [],
  vibeKeys: [],
  amenities: {},
  recommendedDishes: '',
  visitTips: '',
  serviceRating: 0,
  serviceChips: [],
  spaceRating: 0,
  spaceChips: [],
})
const minorUnits = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER))
const priceSchema = z.object({ min: minorUnits, max: minorUnits }).refine((p) => p.max >= p.min)
export function priceValid(form: ContributionForm): boolean {
  return !form.priceKnown || form.unit === 'free' || priceSchema.safeParse(form).success
}
export function stepValid(form: ContributionForm, step: number): boolean {
  if (step === 1) return priceValid(form) && form.purposeKeys.length >= 1 && form.purposeKeys.length <= 10
  if (step === 2) return form.vibeKeys.length >= 1 && form.vibeKeys.length <= 3
  return true // Owner 2026-11-07: all of step 3 is optional.
}
/** Omitted amenities mean unknown, including when a checked item is deselected. */
export function draftEnrichment(form: ContributionForm): EnrichmentDraft {
  return {
    ...(form.priceKnown && priceValid(form)
      ? {
          price: {
            min: form.unit === 'free' ? 0 : Number(form.min),
            max: form.unit === 'free' ? 0 : Number(form.max),
            currency: 'VND',
            unit: form.unit,
          },
        }
      : {}),
    ...(form.purposeKeys.length ? { purposeKeys: form.purposeKeys } : {}),
    ...(form.vibeKeys.length ? { vibeKeys: form.vibeKeys } : {}),
    ...(Object.keys(form.amenities).length ? { amenities: form.amenities } : {}),
    ...(form.recommendedDishes.trim() ? { recommendedDishes: form.recommendedDishes.trim() } : {}),
    ...(form.visitTips.trim() ? { visitTips: form.visitTips.trim() } : {}),
    ...(Number.isInteger(form.serviceRating) && form.serviceRating >= 1 && form.serviceRating <= 5
      ? { service: { rating: form.serviceRating, chipKeys: form.serviceChips } }
      : {}),
    ...(Number.isInteger(form.spaceRating) && form.spaceRating >= 1 && form.spaceRating <= 5
      ? { space: { rating: form.spaceRating, chipKeys: form.spaceChips } }
      : {}),
  }
}
export function submissionEnrichment(form: ContributionForm): Enrichment | undefined {
  if (![1, 2, 3].every((step) => stepValid(form, step))) return undefined
  return draftEnrichment(form) as Enrichment
}
export function resumeContribution(draft: EnrichmentDraft): ContributionForm {
  return {
    ...emptyContribution(),
    priceKnown: !!draft.price,
    min: draft.price ? String(draft.price.min) : '',
    max: draft.price ? String(draft.price.max) : '',
    unit: draft.price?.unit ?? 'per_person',
    purposeKeys: draft.purposeKeys ?? [],
    vibeKeys: draft.vibeKeys ?? [],
    amenities: draft.amenities ?? {},
    recommendedDishes: draft.recommendedDishes ?? '',
    visitTips: draft.visitTips ?? '',
    serviceRating: draft.service?.rating ?? 0,
    serviceChips: draft.service?.chipKeys ?? [],
    spaceRating: draft.space?.rating ?? 0,
    spaceChips: draft.space?.chipKeys ?? [],
  }
}
