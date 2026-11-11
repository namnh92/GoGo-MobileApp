import { render, screen } from '@testing-library/react-native'
import { StyleSheet, View, type ViewStyle } from 'react-native'

import { styles as saved } from '@/features/tabs/saved.style'
import { styles as onboarding } from '@/features/onboarding/onboarding.style'
import { styles as profile } from '@/features/tabs/profile.style'
import { styles as room } from '@/features/gogo-room/gogo-room.style'
import { styles as manage } from '@/features/gogo-room/room-manage.style'
import { styles as search } from '@/features/search/search.style'
import { GhostBtn, IconBtn, PrimaryBtn } from '../button.view'
import { buttonSizes, hitSlop, touchTarget } from '../tokens'
import { constrainedTouchTarget } from './touch-target-geometry'

it('clips a small button to its parent even with generous hitSlop', () => {
  for (const height of [40, 44]) {
    const target = constrainedTouchTarget(
      { x: 0, y: (height - 40) / 2, width: 40, height: 40 },
      { x: 0, y: 0, width: 44, height },
      { top: 100, bottom: 100, left: 100, right: 100 },
    )
    expect(target).toEqual({ width: 44, height })
  }
})

// Every compact Button/IconBtn consumer. Sibling floors come from the actual
// adjacent control/avatar styles. Unlike the size-token tests this intersects
// the expanded target with the immediate parent's shortest content-driven box.
const rows = [
  { name: 'saved province action', style: saved.groupHeader, siblingHeight: 24, icon: false },
  { name: 'saved quick save', style: saved.linkRow, siblingHeight: Number(saved.linkField.height), icon: false },
  { name: 'onboarding back', style: onboarding.header, siblingHeight: 40, icon: true },
  { name: 'onboarding skip', style: onboarding.header, siblingHeight: 0, icon: false },
  { name: 'profile edit', style: profile.identity, siblingHeight: 64, icon: true },
  { name: 'room copy', style: room.codeRow, siblingHeight: 28, icon: true },
  { name: 'room add seed', style: manage.sectionHead, siblingHeight: touchTarget.min, icon: true },
  { name: 'search reset', style: search.sheetFooter, siblingHeight: buttonSizes.regular.minHeight, icon: true },
]

it.each(rows)('$name retains 44pt after parent clipping', async ({ name, style, siblingHeight, icon }) => {
  await render(<View testID="parent" style={style}>
    {icon ? <IconBtn accessibilityLabel={name} onPress={jest.fn()}><></></IconBtn> : <GhostBtn size="small" label={name} onPress={jest.fn()} />}
  </View>)
  const parent = StyleSheet.flatten(screen.getByTestId('parent').props.style) as ViewStyle
  const button = screen.getByRole('button', { name })
  const child = StyleSheet.flatten(button.props.style) as ViewStyle
  const childHeight = Number(child.height ?? child.minHeight)
  const verticalPadding = Number(parent.paddingVertical ?? parent.padding ?? 0)
  const height = Number(parent.height ?? Math.max(Number(parent.minHeight ?? 0), Math.max(childHeight, siblingHeight) + 2 * verticalPadding))
  expect(parent.alignItems).toBe('center')
  const target = constrainedTouchTarget(
    { x: 140, y: (height - childHeight) / 2, width: Number(child.width ?? child.minWidth), height: childHeight },
    { x: 0, y: 0, width: 320, height },
    button.props.hitSlop,
  )
  expect(target.height).toBeGreaterThanOrEqual(touchTarget.min)
  expect(target.width).toBeGreaterThanOrEqual(touchTarget.min)
})

it('keeps the last onboarding guest action reachable at the bottom of its column', async () => {
  await render(<View style={[onboarding.actions, onboarding.lastActions]}>
    <PrimaryBtn label="Start" onPress={jest.fn()} />
    <GhostBtn variant="stitchGuest" label="Guest" onPress={jest.fn()} />
  </View>)
  const guest = screen.getByRole('button', { name: 'Guest' })
  const height = Number(StyleSheet.flatten(guest.props.style).minHeight)
  const y = buttonSizes.regular.minHeight + Number(onboarding.lastActions.gap)
  const target = constrainedTouchTarget({ x: 0, y, width: 320, height }, { x: 0, y: 0, width: 320, height: y + height }, hitSlop)
  expect(target.height).toBeGreaterThanOrEqual(touchTarget.min)
})
