/**
 * Taxonomy from the API carries stable keys and locale labels but no icon, and
 * an icon is presentation rather than business data. Unknown keys simply render
 * without one — a new CMS taxonomy value must never break a screen.
 */
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

export function taxonomyEmoji(key: string): string | undefined {
  return EMOJI_BY_KEY[key]
}
