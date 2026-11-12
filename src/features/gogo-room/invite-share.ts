import * as Clipboard from 'expo-clipboard'
import { Share } from 'react-native'
import { env } from '@/shared/config/env'

/** The canonical share link is the only URL that carries an invite code. */
export function roomInviteUrl(code: string): string {
  return `${env.webBaseUrl}/r/${code}`
}

/** Native chooser with the lobby's copy-link fallback. Never log the payload. */
export async function shareRoomInvite(code: string, title: string): Promise<'shared' | 'copied'> {
  const url = roomInviteUrl(code)
  try {
    await Share.share({ message: `${title} ${url}`, url })
    return 'shared'
  } catch {
    await Clipboard.setStringAsync(url)
    return 'copied'
  }
}
