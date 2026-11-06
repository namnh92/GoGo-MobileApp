/** Fit a complete illustration into the screen, preserving its own coordinate space. */
export function fitIllustration(width: number, height: number, top: number, bottom: number, artHeight: number) {
  const scale = Math.max(0, Math.min(Math.max(0, width - 40) / 350, Math.max(0, height - top - bottom) * 0.48 / artHeight))
  return { scale, width: 350 * scale, height: artHeight * scale }
}
