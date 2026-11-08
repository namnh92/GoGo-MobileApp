/** Crop coordinates are in the rotated/flipped image; pan is in viewport points. */
export type AvatarAdjustment = { zoom: number; x: number; y: number; rotation: number; flipped: boolean }
export const DEFAULT_AVATAR_ADJUSTMENT: AvatarAdjustment = { zoom: 1.25, x: 0, y: 0, rotation: 0, flipped: false }

export function avatarGeometry(width: number, height: number, viewport: number, value: AvatarAdjustment) {
  const rotated = value.rotation % 180 !== 0
  const w = rotated ? height : width
  const h = rotated ? width : height
  const diameter = viewport * 0.8
  const scale = Math.max(viewport / w, viewport / h) * Math.max(1, Math.min(2.5, value.zoom))
  const x = Math.max(-(w * scale - diameter) / 2, Math.min((w * scale - diameter) / 2, value.x))
  const y = Math.max(-(h * scale - diameter) / 2, Math.min((h * scale - diameter) / 2, value.y))
  const size = Math.max(1, Math.min(w, h, Math.floor(diameter / scale + 1e-7)))
  return { scale, x, y, crop: {
    originX: Math.max(0, Math.min(w - size, Math.round((w - diameter / scale) / 2 - x / scale))),
    originY: Math.max(0, Math.min(h - size, Math.round((h - diameter / scale) / 2 - y / scale))),
    width: size, height: size,
  } }
}
