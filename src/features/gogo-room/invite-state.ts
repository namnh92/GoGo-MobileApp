import { z } from 'zod'

import type { StoredInvite } from '@/shared/storage/invite-codes'

/**
 * One `GET /rooms/{id}/invites` row. Host-only metadata; the contract never
 * lists a code (GoGo-BE ADR-0018), and declares no schema for it, so the list
 * is validated here before anything is decided from it.
 */
const inviteMetaSchema = z.object({
  inviteId: z.string().min(1),
  expiresAt: z.string(),
  revoked: z.boolean().optional(),
  useCount: z.number().int().nonnegative().optional(),
  maxUses: z.number().int().positive().nullish(),
})
export type InviteMeta = z.infer<typeof inviteMetaSchema>
const inviteListSchema = z.array(inviteMetaSchema)

/** Not revoked, not expired, and not used up. */
export function isInviteUsable(invite: InviteMeta, now: number): boolean {
  const expiresAt = Date.parse(invite.expiresAt)
  if (invite.revoked || !Number.isFinite(expiresAt) || expiresAt <= now) return false
  return invite.maxUses == null || (invite.useCount ?? 0) < invite.maxUses
}

export type InviteDisplay =
  /** This device's store has not been read yet, or the list has not arrived. */
  | { kind: 'checking' }
  | { kind: 'code'; inviteId: string; code: string; expiresAt: string }
  /**
   * Usable on the server, but created on another device or before a reinstall.
   * Every usable invite is named, latest expiry first: a re-issue must revoke
   * them all, or an older duplicate keeps letting people in.
   */
  | { kind: 'active-elsewhere'; inviteIds: string[]; expiresAt: string }
  | { kind: 'none' }
  /** The list could not be read and this device holds no code to fall back on. */
  | { kind: 'unknown' }

export interface InviteDisplayInput {
  /** The code this device stored for the room; `undefined` until the store has been read. */
  stored: StoredInvite | null | undefined
  /** The invite list as last received, possibly from cache; `undefined` before any arrives. */
  invites: unknown
  invitesFailed: boolean
  /** The list was fetched after `stored` was saved, and nothing is refetching it. */
  listIsCurrent: boolean
  now: number
}

/**
 * GoGo-MobileApp#199: what the host's invite card shows, and whether the stored
 * code is dead and must be forgotten. The list is the authority on whether an
 * invite still works; the device is the only source of its code.
 */
export function resolveInviteDisplay(input: InviteDisplayInput): { display: InviteDisplay; forget: boolean } {
  const { stored, now } = input
  if (stored === undefined) return { display: { kind: 'checking' }, forget: false }

  const live = stored && Date.parse(stored.expiresAt) > now ? stored : null
  const expired = Boolean(stored) && !live
  const asCode = (invite: StoredInvite): InviteDisplay => ({
    kind: 'code',
    inviteId: invite.inviteId,
    code: invite.code,
    expiresAt: invite.expiresAt,
  })

  if (input.invites === undefined && !input.invitesFailed) {
    return { display: { kind: 'checking' }, forget: expired }
  }
  const parsed = input.invites === undefined ? null : inviteListSchema.safeParse(input.invites)
  if (!parsed?.success) {
    // Offline or unreadable: the device's own unexpired code is still the best answer.
    return { display: live ? asCode(live) : { kind: 'unknown' }, forget: expired }
  }

  const list = parsed.data
  const listed = live ? list.find(invite => invite.inviteId === live.inviteId) : undefined
  if (live && listed && isInviteUsable(listed, now)) return { display: asCode(live), forget: false }
  // A list older than the code cannot say it is gone.
  if (live && !listed && !input.listIsCurrent) return { display: asCode(live), forget: false }

  const forget = expired || Boolean(live)
  const usable = list
    .filter(invite => isInviteUsable(invite, now) && invite.inviteId !== live?.inviteId)
    .sort((a, b) => Date.parse(b.expiresAt) - Date.parse(a.expiresAt))
  return {
    display: usable.length > 0
      ? { kind: 'active-elsewhere', inviteIds: usable.map(invite => invite.inviteId), expiresAt: usable[0].expiresAt }
      : { kind: 'none' },
    forget,
  }
}
