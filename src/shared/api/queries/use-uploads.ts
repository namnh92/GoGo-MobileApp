import { useMutation } from '@tanstack/react-query'

import * as uploadsApi from '../endpoints/uploads'
import type { OpBody } from '../types'

type Purpose = OpBody<'createUpload'>['purpose']
type ContentType = OpBody<'createUpload'>['contentType']

/** What the picker hands us, narrowed to what the contract will sign. */
export interface LocalImage {
  uri: string
  /** Picker mime type; anything the contract does not sign is rejected here. */
  mimeType?: string
}

const SIGNABLE: Record<string, ContentType> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
  'image/heic': 'image/heic',
}

/**
 * Reads the picked file so its real size and type can be declared up front —
 * `createUpload` refuses an oversized file before a URL exists, which is only
 * possible if the client is honest about `contentLength`.
 */
async function readLocal(image: LocalImage): Promise<{ blob: Blob; contentType: ContentType }> {
  const response = await fetch(image.uri)
  const blob = await response.blob()
  const declared = (image.mimeType ?? blob.type ?? '').toLowerCase()
  const contentType = SIGNABLE[declared]
  if (!contentType) throw new Error('UNSUPPORTED_IMAGE_TYPE')
  return { blob, contentType }
}

/**
 * Presign, PUT, return the key.
 *
 * The key is all the caller keeps: check-in sends `photoKeys`/`billPhotoKey`,
 * never bytes. A failure here must not take the surrounding flow down with it —
 * a check-in without its photo is still a check-in.
 */
export function useUploadImage() {
  return useMutation({
    mutationFn: async ({ image, purpose }: { image: LocalImage; purpose: Purpose }): Promise<string> => {
      const { blob, contentType } = await readLocal(image)
      const authorized = await uploadsApi.createUpload({
        purpose,
        contentType,
        contentLength: blob.size,
      })
      if (!authorized?.uploadUrl || !authorized.key) throw new Error('UPLOAD_NOT_AUTHORIZED')
      if (authorized.maxBytes != null && blob.size > authorized.maxBytes) throw new Error('IMAGE_TOO_LARGE')

      await uploadsApi.putPresigned(authorized.uploadUrl, blob, contentType)
      return authorized.key
    },
  })
}
