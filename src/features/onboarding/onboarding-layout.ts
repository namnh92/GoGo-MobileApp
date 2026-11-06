/** Fit a complete illustration into the screen, preserving its own coordinate space. */
export function fitIllustration(width: number, height: number, top: number, bottom: number, artHeight: number, artWidth = 350) {
  const scale = Math.max(0, Math.min(Math.max(0, width - 40) / artWidth, Math.max(0, height - top - bottom) * 0.48 / artHeight))
  return { scale, width: artWidth * scale, height: artHeight * scale }
}

export type IllustrationRect = { x: number; y: number; width: number; height: number; rotation?: number }

/** React Native rotates around the rectangle centre, after layout. */
export function rotatedBounds({ x, y, width, height, rotation = 0 }: IllustrationRect) {
  const radians = rotation * Math.PI / 180
  const rotatedWidth = Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians))
  const rotatedHeight = Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians))
  return { x: x + (width - rotatedWidth) / 2, y: y + (height - rotatedHeight) / 2, width: rotatedWidth, height: rotatedHeight }
}

/** Keep the original stage coordinates fixed; reserve and translate its entire union. */
export function illustrationEnvelope(rectangles: IllustrationRect[]) {
  const bounds = rectangles.map(rotatedBounds)
  const x = Math.min(0, ...bounds.map(rect => rect.x))
  const y = Math.min(0, ...bounds.map(rect => rect.y))
  const right = Math.max(350, ...bounds.map(rect => rect.x + rect.width))
  const bottom = Math.max(340, ...bounds.map(rect => rect.y + rect.height))
  return { x, y, width: right - x, height: bottom - y }
}
