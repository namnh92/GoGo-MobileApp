import { useEffect, useState } from 'react'
import { z } from 'zod'
import { api } from './client'
import type { OpResponse, ResolveLinkResult } from './types'

// Validate untrusted JSON as well as compiling against the vendored BFF contract.
// An absent reference buys no request. Bytes stay in this mounted view only.
const photoResponse = z.object({
  status: z.literal('ok'),
  attribution: z.string().min(1),
  photos: z
    .array(
      z.object({
        contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
        dataBase64: z.string().min(1),
        authorAttributions: z.array(z.object({ displayName: z.string().trim().min(1) })).min(1),
      }),
    )
    .min(1),
})

type LoadedPhoto = { path: string; uri: string; credit: string }
type PhotoState = { path: string; status: 'ready'; photo: LoadedPhoto } | { path: string; status: 'absent' | 'error' }

export function useCandidatePhoto(candidate: NonNullable<ResolveLinkResult['candidate']>) {
  const id = candidate.googlePlaceId
  const expected = id && /^[A-Za-z0-9_-]{5,255}$/.test(id) ? `/places/google-provider-photo/${id}` : null
  const path = expected && candidate.photo?.provider === 'google' && candidate.photo.url === `/v1${expected}` ? expected : null
  const [loaded, setLoaded] = useState<PhotoState | null>(null)
  const [previousPath, setPreviousPath] = useState(path)
  // Clear during render so revisiting a reference never revives old photo bytes.
  if (previousPath !== path) {
    setPreviousPath(path)
    setLoaded(null)
  }
  useEffect(() => {
    if (!path) return
    let active = true
    const controller = new AbortController()
    void api
      .get<OpResponse<'getCandidateProviderPhoto'>>(path, { anonymous: true, signal: controller.signal })
      .then(response => {
        const result = photoResponse.safeParse(response)
        if (!active) return
        if (!result.success) {
          setLoaded({ path, status: 'absent' })
          return
        }
        const photo = result.data.photos[0]
        setLoaded({
          path,
          status: 'ready',
          photo: {
            path,
            uri: `data:${photo.contentType};base64,${photo.dataBase64}`,
            credit: [result.data.attribution, ...photo.authorAttributions.map(author => author.displayName)].join(' · '),
          },
        })
      })
      .catch(() => {
        if (active) setLoaded({ path, status: 'error' })
      }) // Photo failure never blocks place submission.
    return () => {
      active = false
      controller.abort()
    }
  }, [path])
  if (!path) return { status: 'absent' as const, photo: null }
  if (loaded?.path !== path) return { status: 'loading' as const, photo: null }
  return { status: loaded.status, photo: loaded.status === 'ready' ? loaded.photo : null }
}
