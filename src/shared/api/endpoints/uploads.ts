import { api } from '../client'
import type { OpBody, OpResponse } from '../types'

/**
 * Presigned upload for moderated user media.
 *
 * Presigned rather than multipart: the client PUTs bytes straight to storage
 * and sends only the returned `key` back with the check-in. Image bytes never
 * cross the API, and the key is bound to the actor that asked for it.
 */
export function createUpload(body: OpBody<'createUpload'>): Promise<OpResponse<'createUpload'>> {
  return api.post<OpResponse<'createUpload'>>('/uploads', body)
}

/**
 * PUTs the bytes to the presigned URL.
 *
 * The content type is part of what was signed, so it must match the value
 * declared to `createUpload` exactly — storage refuses an upload that does not.
 * This deliberately does not go through `api`: the URL is object storage, not
 * the BFF, and attaching the session token to it would leak the credential to
 * a third party.
 */
export async function putPresigned(uploadUrl: string, blob: Blob, contentType: string): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  })
  if (!response.ok) {
    // The presigned URL is a credential; it must never reach a log or a message.
    throw new Error(`Upload rejected by storage (${response.status})`)
  }
}
