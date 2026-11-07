import { z } from 'zod'

export const mapsUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2000)
  .refine((value) => {
    try {
      const parsed = new URL(value)
      const host = parsed.hostname.replace(/^www\./, '')
      return (
        ['https:', 'http:'].includes(parsed.protocol) &&
        (host === 'maps.google.com' ||
          host === 'maps.app.goo.gl' ||
          (host === 'goo.gl' && parsed.pathname.startsWith('/maps/')) ||
          (host === 'google.com' && /^\/maps(?:\/|$)/.test(parsed.pathname)) ||
          (host.endsWith('.google.com') && /^\/maps(?:\/|$)/.test(parsed.pathname)))
      )
    } catch {
      return false
    }
  })

