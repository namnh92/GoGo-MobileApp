import { api } from '../client'
import type { OpResponse } from '../types'

/**
 * Resolve a canonical share link (LNK-BE-002).
 *
 * Public on purpose: the slug *is* the credential, and a link has to work on a
 * phone that has never signed in — which is the whole point of sharing one. The
 * answer carries the target's type and id only; the client still authorises
 * through that entity's own endpoint afterwards.
 *
 * 404 means nobody minted this slug, 410 that it was revoked, expired, or its
 * invite is spent. Those are different sentences to a person, so callers must
 * tell them apart rather than collapsing both into "something went wrong".
 */
export function resolveShareLink(slug: string): Promise<OpResponse<'resolveShareLink'>> {
  return api.get<OpResponse<'resolveShareLink'>>('/share-links/{slug}', {
    pathParams: { slug },
    anonymous: true,
  })
}
