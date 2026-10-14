import { env } from '@/shared/config/env'
import { getSession, subscribeToSession, type Session } from '@/shared/api/session'

import { initSentry, sentryEnvironment, setSentryUser } from './sentry'

/**
 * GoGo-MobileApp#336 — crash reporting starts here, as a side effect of the
 * first import in `src/app/_layout.tsx`. Imports evaluate in order and are
 * hoisted above every statement, so this is the only way to run before
 * `@/shared/i18n` and the rest of the app's modules.
 *
 * The session wiring lives here rather than in `session.ts` on purpose: the
 * API layer stays free of the SDK, so its node-environment suites never load
 * React Native.
 */

/** Signed-in users only. A guest is room-scoped and anonymous by design (D-8). */
function sentryUserId(session: Session | null): string | null {
  return session?.kind === 'user' ? (session.userId ?? null) : null
}

initSentry({ dsn: env.sentryDsn, environment: sentryEnvironment(env.name) })
setSentryUser(sentryUserId(getSession()))
subscribeToSession(session => setSentryUser(sentryUserId(session)))
