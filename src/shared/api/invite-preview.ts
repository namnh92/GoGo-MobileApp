import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { api } from './client'
import type { OpBody, OpResponse } from './types'

const previewSchema: z.ZodType<OpResponse<'previewRoomInvite'>> = z.object({
  inviter: z.object({ displayName: z.string().min(1), avatarUrl: z.url().nullable(), emailVerified: z.boolean() }),
  roomType: z.enum(['couple', 'group']),
  participantCount: z.number().int().nonnegative(),
  startAt: z.iso.datetime({ offset: true }).optional(),
  endAt: z.iso.datetime({ offset: true }).optional(),
  area: z.object({ source: z.enum(['administrative_area', 'service_area']), name: z.string().min(1), city: z.string().optional() }).optional(),
  budget: z.object({ mode: z.enum(['total', 'per_person']), amount: z.number().int().nonnegative(), currency: z.string().regex(/^[A-Z]{3}$/) }).optional(),
})

export async function previewRoomInvite(body: OpBody<'previewRoomInvite'>, signal?: AbortSignal): Promise<OpResponse<'previewRoomInvite'>> {
  const value = await api.post<unknown>('/rooms/invites/preview', body, { anonymous: true, signal })
  const parsed = previewSchema.safeParse(value)
  // Never expose an untrusted payload (or credential) through validation errors.
  if (!parsed.success) throw new Error('INVALID_INVITE_PREVIEW')
  return parsed.data
}

let nextPreview = 0
export function useInvitePreview(inviteCode: string | undefined, enabled: boolean) {
  // Opaque per-mount identity. A changed deep link must never show old facts.
  const identity = useMemo(() => ({ id: ++nextPreview, code: inviteCode }), [inviteCode])
  return useQuery({
    queryKey: ['invite-preview', identity.id],
    queryFn: ({ signal }) => previewRoomInvite({ inviteCode: identity.code! }, signal),
    enabled: enabled && Boolean(inviteCode),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    networkMode: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}
