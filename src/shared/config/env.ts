import { z } from 'zod'

// Fail fast on invalid config (WBS FND-006). EXPO_PUBLIC_* values are compiled
// into the bundle — never put secrets here.
const envSchema = z.object({
  // Same three tokens `app.config.ts` builds `max.gogo.{flavor}` from, so the
  // running app and the binary it runs in can never disagree about which
  // environment this is.
  EXPO_PUBLIC_ENV: z.enum(['dev', 'stag', 'prod']).default('dev'),
  EXPO_PUBLIC_API_URL: z.url(),
  EXPO_PUBLIC_WEB_BASE_URL: z.url().default('https://gogo.app'),
})

const parsed = envSchema.safeParse({
  EXPO_PUBLIC_ENV: process.env.EXPO_PUBLIC_ENV,
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_WEB_BASE_URL: process.env.EXPO_PUBLIC_WEB_BASE_URL,
})

if (!parsed.success) {
  throw new Error(`Invalid app config: ${parsed.error.message}`)
}

export const env = {
  name: parsed.data.EXPO_PUBLIC_ENV,
  apiUrl: parsed.data.EXPO_PUBLIC_API_URL,
  webBaseUrl: parsed.data.EXPO_PUBLIC_WEB_BASE_URL,
} as const
