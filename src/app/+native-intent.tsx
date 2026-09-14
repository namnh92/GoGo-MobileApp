import { systemPathFor } from '@/shared/navigation/deep-link'

/**
 * Expo Router hands every URL the OS delivers — at launch (`initial: true`) and
 * while the app is running — to this function before it matches a route.
 * `systemPathFor` holds the one rewrite (GoGo-MobileApp#203).
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return systemPathFor(path)
}
