/**
 * Taxonomy from the API carries stable keys and locale labels but no icon, and
 * an icon is presentation rather than business data. Unknown keys simply render
 * without one — a new CMS taxonomy value must never break a screen.
 */
const CATEGORY_EMOJI_BY_KEY: Record<string, string> = {
  // category
  cafe: '☕',
  restaurant: '🍜',
  bar: '🍸',
  park: '🏞️',
  museum: '🖼️',
  cinema: '🎬',
  shopping: '🛍️',
  lodging: '🛏️',
}

const EMOJI_BY_KEY: Record<string, string> = {
  // mood
  romantic: '❤️',
  chill: '😌',
  creative: '🎨',
  playful: '🎮',
  adventurous: '🧭',
  festive: '🎉',
  cozy: '🕯️',
  night_vibe: '🌃',
  // setting
  indoor: '🏠',
  outdoor: '🌳',
  rooftop: '🌆',
  riverside: '🌊',
  // spending style
  saver: '💸',
  balanced: '⚖️',
  treat: '✨',
  ...CATEGORY_EMOJI_BY_KEY,
}

export function taxonomyEmoji(key: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(EMOJI_BY_KEY, key) ? EMOJI_BY_KEY[key] : undefined
}

/** Category-only lookup: mood/setting keys are not place types. */
export function categoryEmoji(key: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(CATEGORY_EMOJI_BY_KEY, key) ? CATEGORY_EMOJI_BY_KEY[key] : undefined
}
