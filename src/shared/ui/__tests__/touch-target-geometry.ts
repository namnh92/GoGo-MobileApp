type Rect = { x: number; y: number; width: number; height: number }
type Insets = { top: number; bottom: number; left: number; right: number }

/** RN clips hitSlop at parent bounds, even when overflow is visible. */
export function constrainedTouchTarget(child: Rect, parent: Rect, slop: Insets) {
  return {
    width: Math.max(0, Math.min(parent.x + parent.width, child.x + child.width + slop.right) - Math.max(parent.x, child.x - slop.left)),
    height: Math.max(0, Math.min(parent.y + parent.height, child.y + child.height + slop.bottom) - Math.max(parent.y, child.y - slop.top)),
  }
}
