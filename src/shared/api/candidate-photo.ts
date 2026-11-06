import { useEffect, useState } from 'react'
import { z } from 'zod'
import { api } from './client'

// Additive read adapter for BE#792 @4ca9b46. The bundled generated contract
// stays unchanged until that PR lands. An absent reference buys no request.
const reference = z.object({ googlePlaceId: z.string(), photo: z.object({ provider: z.literal('google'), url: z.string() }) })
const photoResponse = z.object({
  status: z.literal('ok'),
  attribution: z.string().min(1),
  photos: z
    .array(
      z.object({
        contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
        dataBase64: z.string().min(1),
        authorAttributions: z.array(z.object({ displayName: z.string() })),
      }),
    )
    .min(1),
})

export function useCandidatePhoto(candidate: unknown) {
  const parsed = reference.safeParse(candidate)
  const id = parsed.success ? parsed.data.googlePlaceId : null
  const expected = id && /^[A-Za-z0-9_-]{5,255}$/.test(id) ? `/places/google-provider-photo/${id}` : null
  const path = parsed.success && parsed.data.photo.url === `/v1${expected}` ? expected : null
  const [loaded, setLoaded] = useState<{ path: string; uri: string; credit: string } | null>(null)
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
      .get<unknown>(path, { anonymous: true, signal: controller.signal })
      .then(response => {
        const result = photoResponse.safeParse(response)
        if (!active || !result.success) return
        const photo = result.data.photos[0]
        setLoaded({
          path,
          uri: `data:${photo.contentType};base64,${photo.dataBase64}`,
          credit: [result.data.attribution, ...photo.authorAttributions.map(author => author.displayName)].join(' · '),
        })
      })
      .catch(() => {}) // Photo failure never blocks place submission.
    return () => {
      active = false
      controller.abort()
    }
  }, [path])
  return path && loaded?.path === path ? loaded : null
}
