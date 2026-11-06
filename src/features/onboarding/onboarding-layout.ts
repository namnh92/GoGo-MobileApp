/** Fit a complete illustration into the screen, preserving its own coordinate space. */
export function fitIllustration(width: number, height: number, top: number, bottom: number, artHeight: number, artWidth = 350, remainingArtHeight = Infinity) {
  const scale = Math.max(0, Math.min(Math.max(0, width - 40) / artWidth, Math.max(0, height - top - bottom) * 0.48 / artHeight, Math.max(0, remainingArtHeight) / artHeight))
  return { scale, width: artWidth * scale, height: artHeight * scale }
}

/** External margins only; measured block heights include their own padding/gaps. */
export function onboardingSpacing(slide: number) {
  return {
    header: slide > 0 ? 12 : 0,
    visualTop: slide === 2 ? 12 : 6,
    visualBottom: slide === 2 ? 12 : 0,
    narrative: slide === 1 ? 8 : 24,
    dotsTop: slide === 2 ? 8 : slide === 1 ? 16 : 24,
    dotsBottom: slide === 2 ? 16 : 0,
    actions: slide === 2 ? 16 : 24,
    bottom: 20,
  }
}

export function onboardingArrangement(viewportHeight: number, nonArtHeight: number, fittedArtHeight: number, fontScale: number, complete: boolean) {
  const remaining = viewportHeight - nonArtHeight
  // Astra: enlarged text keeps the independent art fit, scrolling above both
  // actions on overflow. No arbitrary minimum art size, or zero-height success.
  const footer = !complete || remaining <= 0 || (fontScale > 1 && fittedArtHeight > remaining)
  return { footer, artBudget: footer ? undefined : remaining, spare: footer ? 0 : Math.max(0, remaining - fittedArtHeight) }
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
