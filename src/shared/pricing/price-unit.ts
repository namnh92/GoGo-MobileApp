import type { PlaceDetail } from '@/shared/api/types'

/**
 * What a price is *per* (spec §5).
 *
 * The contract's `PlaceDetail.prices[].unit` covers four of these; `per_group`,
 * `free` and `unknown` have no contract member yet, so they are modelled here
 * and mapped conservatively. Modelling them client-side is what makes the
 * forbidden renderings impossible: nothing in this app can emit `450k /2`,
 * because no formatter takes a divisor — it takes a unit.
 */
export type PriceUnit =
  | 'per_person'
  | 'per_group'
  | 'per_item'
  | 'per_hour'
  | 'per_night'
  | 'free'
  | 'unknown'

type ContractUnit = NonNullable<NonNullable<PlaceDetail['prices']>[number]['unit']>

const CONTRACT_UNITS: Record<ContractUnit, PriceUnit> = {
  per_person: 'per_person',
  per_item: 'per_item',
  per_hour: 'per_hour',
  per_night: 'per_night',
}

/**
 * A price row with no unit is not a per-person price — it is a price whose
 * scope nobody stated, and saying "mỗi người" about it would be an invention.
 */
export function toPriceUnit(unit: string | undefined, hasPrice: boolean): PriceUnit {
  if (!hasPrice) return 'unknown'
  if (unit && unit in CONTRACT_UNITS) return CONTRACT_UNITS[unit as ContractUnit]
  return 'unknown'
}

/** i18n key for the unit suffix. `free` and `unknown` carry the whole line. */
export function priceUnitKey(unit: PriceUnit): string {
  return `price.unit.${unit}`
}

/** True when the unit says the whole line, not a suffix after an amount. */
export function isStandalonePrice(unit: PriceUnit): boolean {
  return unit === 'free' || unit === 'unknown'
}
