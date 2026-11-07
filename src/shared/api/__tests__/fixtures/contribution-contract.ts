import type { OpBody } from '../../types'

type Enrichment = OpBody<'savePlaceContributionDraft'>['enrichment']

const price: NonNullable<Enrichment['price']> = { min: 0, max: 100000, currency: 'VND', unit: 'per_person' }
// @ts-expect-error Contributions only accept VND.
price.currency = 'USD'
// @ts-expect-error Price amounts are numbers in minor units.
price.min = '100000'
// @ts-expect-error Units must come from the contribution contract.
price.unit = 'unknown'

const service: NonNullable<Enrichment['service']> = { rating: 5, chipKeys: ['service_friendly'] }
// @ts-expect-error Ratings must remain numeric.
service.rating = '5'
// @ts-expect-error Taxonomy chip keys are strings.
service.chipKeys = [1]

const space: NonNullable<Enrichment['space']> = { rating: 4, chipKeys: ['space_quiet'] }
// @ts-expect-error Space ratings share the same strict contract.
space.rating = '4'
// @ts-expect-error Space chip keys must also remain strings.
space.chipKeys = [false]
