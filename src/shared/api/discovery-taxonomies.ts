import type { TaxonomyLabels } from './view-models'
import type { OpResponse } from './types'

/** Unknown/unlabelled keys stay hidden; never show a raw English key as copy. */
export function discoveryLabels(data: OpResponse<'listTaxonomies'> | undefined, locale: string): TaxonomyLabels {
  return Object.fromEntries(Object.entries(data?.kinds ?? {}).map(([kind, entries]) => [kind,
    Object.fromEntries(entries.flatMap(entry => {
      const label = entry.labels?.[locale.split('-')[0]!] ?? entry.labels?.vi
      return entry.key && label ? [[entry.key, label]] : []
    })),
  ]))
}
