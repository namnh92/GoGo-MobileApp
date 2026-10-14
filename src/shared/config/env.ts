import { z } from 'zod'

// Fail fast on invalid config (WBS FND-006). EXPO_PUBLIC_* values are compiled
// into the bundle — never put secrets here.
const envSchema = z.object({
  // Same three tokens `app.config.ts` builds `max.gogo.{flavor}` from, so the
  // running app and the binary it runs in can never disagree about which
  // environment this is.
  EXPO_PUBLIC_ENV: z.enum(['dev', 'stag', 'prod']).default('dev'),
  EXPO_PUBLIC_API_URL: z.url(),
  // No default. The share host differs per environment (go-dev / go-stag /
  // go.gogo.id.vn) and a link built against the wrong one cannot verify
  // against that host's association files, so a missing value has to fail the
  // way a missing API URL does rather than silently pick one.
  EXPO_PUBLIC_WEB_BASE_URL: z.url(),
  // Crash reporting (GoGo-MobileApp#336, GoGo-Infra ADR-0011). Config, not a
  // secret: it ships in the binary. `''` or the literal `off` = no reporting;
  // anything else must be a DSN, which `initSentry` checks. `app.config.ts`
  // refuses a stag/prod build that states neither.
  EXPO_PUBLIC_SENTRY_DSN: z.string().default(''),
})

const parsed = envSchema.safeParse({
  EXPO_PUBLIC_ENV: process.env.EXPO_PUBLIC_ENV,
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_WEB_BASE_URL: process.env.EXPO_PUBLIC_WEB_BASE_URL,
  EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
})

if (!parsed.success) {
  throw new Error(`Invalid app config: ${parsed.error.message}`)
}

export const env = {
  name: parsed.data.EXPO_PUBLIC_ENV,
  apiUrl: parsed.data.EXPO_PUBLIC_API_URL,
  webBaseUrl: parsed.data.EXPO_PUBLIC_WEB_BASE_URL,
  sentryDsn: parsed.data.EXPO_PUBLIC_SENTRY_DSN,
} as const
