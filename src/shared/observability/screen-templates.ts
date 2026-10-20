/**
 * GoGo-MobileApp#341 — every route of the app as `useSegments()` names it: the
 * file names under `src/app/`, `index` dropped, `_layout` and `+native-intent`
 * excluded (they are not screens). The `screen` tag is one of these or
 * `unknown`, never anything a URL put there: Expo Router appends a `?screen=`
 * query value to the segments (Sol F-01, PR #349).
 *
 * `screen-tag.spec.tsx` fails when this list and `src/app/` differ, so a new
 * route is added here in the same change.
 */
export const SCREEN_TEMPLATES: ReadonlySet<string> = new Set([
  '/',
  '/(tabs)',
  '/(tabs)/plans',
  '/(tabs)/profile',
  '/(tabs)/saved',
  '/+not-found',
  '/auth/sign-in',
  '/create/budget',
  '/create/group-setup',
  '/create/location',
  '/create/mood',
  '/create/time',
  '/create/type',
  '/join',
  '/l/[slug]',
  '/notifications',
  '/onboarding',
  '/places/[placeId]',
  '/places/import',
  '/places/search',
  '/plans/[planId]',
  '/plans/[planId]/active',
  '/plans/[planId]/edit',
  '/plans/[planId]/finished',
  '/plans/[planId]/review',
  '/r/[inviteCode]',
  '/room/[roomId]',
  '/room/[roomId]/manage',
  '/room/[roomId]/match-result',
  '/room/[roomId]/matching',
  '/room/[roomId]/preference',
  '/room/[roomId]/shared-result',
  '/room/[roomId]/swipe',
  '/settings/account',
  '/settings/location',
  '/settings/notifications',
  '/settings/reviews',
])
