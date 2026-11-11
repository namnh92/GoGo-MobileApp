import { queryOptions, useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { api } from './client'
import { ApiError, NetworkError, TimeoutError } from './errors'
import type { OpResponse, ResolveLinkResult } from './types'

// Validate untrusted JSON as well as compiling against the vendored BFF contract.
// An absent reference buys no request. Validated bytes are shared across screens.
const photoResponse = z.object({
  status: z.literal('ok'),
  attribution: z.string().min(1),
  photos: z
    .array(
      z.object({
        contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
        dataBase64: z.string().min(1),
        authorAttributions: z.array(z.object({ displayName: z.string().trim().min(1), uri: z.string().nullish() })).min(1),
      }),
    )
    .min(1),
})

type LoadedPhoto = { path: string; uri: string; attribution: string; authors: { displayName: string; uri?: string | null }[] }
function retryable(error: unknown) {
  // The envelope is authoritative, including retryable:false on a 429/5xx.
  return error instanceof ApiError ? error.retryable : error instanceof NetworkError || error instanceof TimeoutError
}

/** Public provider bytes stay fresh and retained for this QueryClient's lifetime. */
export function candidatePhotoOptions(placeId: string | null) {
  const path = `/places/google-provider-photo/${placeId}`
  return queryOptions({
    queryKey: ['candidate-provider-photo', placeId],
    // Let an in-flight read settle into the cache even if its last screen leaves.
    // TanStack Query shares the same promise across observers and StrictMode replay.
    queryFn: async (): Promise<LoadedPhoto | null> => {
      const response = await api.get<OpResponse<'getCandidateProviderPhoto'>>(path, { anonymous: true })
      const result = photoResponse.safeParse(response)
      if (!result.success) return null
      const photo = result.data.photos[0]
      return {
        path,
        uri: `data:${photo.contentType};base64,${photo.dataBase64}`,
        attribution: result.data.attribution,
        authors: photo.authorAttributions.map(author => {
          const uri = author.uri?.trim()
          const profile = uri?.startsWith('//') ? `https:${uri}` : uri
          return { displayName: author.displayName, uri: profile && /^https?:\/\/[^\s/]+/i.test(profile) ? profile : undefined }
        }),
      }
    },
    enabled: placeId !== null,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: (failureCount, error) => failureCount < 3 && retryable(error),
    retryDelay: (attempt, error) => Math.max(2000 * 2 ** attempt, error instanceof ApiError ? error.retryAt - Date.now() : 0),
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retryOnMount: false,
  })
}

export function useCandidatePhoto(candidate: NonNullable<ResolveLinkResult['candidate']>) {
  const id = candidate.googlePlaceId
  const expected = id && /^[A-Za-z0-9_-]{5,255}$/.test(id) ? `/places/google-provider-photo/${id}` : null
  const valid = expected && candidate.photo?.provider === 'google' && candidate.photo.url === `/v1${expected}`
  const query = useQuery(candidatePhotoOptions(valid ? id! : null))
  if (!valid) return { status: 'absent' as const, photo: null }
  if (query.data) return { status: 'ready' as const, photo: query.data }
  if (query.isError) return { status: retryable(query.error) ? 'loading' as const : 'error' as const, photo: null }
  return { status: query.isPending ? 'loading' as const : 'absent' as const, photo: null }
}
