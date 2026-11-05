import { Linking } from 'react-native'

/** Resolves true when the system accepted the hand-off, false when nothing could open it. */
async function open(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url)
    return true
  } catch {
    return false
  }
}

/** Asks the system to dial: iOS confirms itself, Android opens the dialer. Nothing dials by itself. */
export function openPhone(phone: string): Promise<boolean> {
  const digits = phone.replace(/[^\d+]/g, '')
  if (!digits) return Promise.resolve(false)
  return open(`tel:${digits}`)
}

/** External browser only; adds https:// to a bare host and refuses any scheme but http(s). */
export function openWebsite(value: string): Promise<boolean> {
  const site = value.trim()
  // `name:` is a scheme unless the name is a dotted host or localhost (`host.example:8080`).
  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(site)
  if (scheme && !/^https?$/i.test(scheme[1]) && !scheme[1].includes('.') && scheme[1].toLowerCase() !== 'localhost') {
    return Promise.resolve(false)
  }
  const url = /^https?:\/\//i.test(site) ? site : `https://${site.replace(/^\/\//, '')}`
  if (!/^https?:\/\/[^\s/]+/i.test(url)) return Promise.resolve(false)
  return open(url)
}
