import type { ReactNode } from 'react'
import { useAppTheme } from '@/shared/ui/scoped-theme'
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg'

import { resolveColor, type TextColor } from '@/shared/ui/text'

/**
 * The icon set (#382, UI-AI-002 §3). One grid and one weight for every glyph:
 * a 24-unit `viewBox`, a 1.8 stroke with round caps and joins, and a colour
 * that is a prop. Nothing here names a colour of its own — `Icon` takes a
 * semantic role (the same keys as `<Text color>`) and resolves it from the
 * active theme, so an accent change reaches every icon and the contrast test
 * measures what ships.
 *
 * Emoji in UI copy are replaced with these (they render differently on every
 * platform, cannot take a theme colour, and a screen reader reads them out).
 * The assistant's icon set builds on `Icon`. `__tests__/design-drift.test.ts`
 * keeps the grid, the weight and the "no fixed colour" rule.
 */
export const ICON_STROKE = 1.8

/** The assistant's speech-bubble head (#379), shared by the outline icon and the solid avatar. */
const ASSISTANT_BUBBLE = 'M7 5h10a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4H9.5L6 21v-3.13A4 4 0 0 1 3 14V9a4 4 0 0 1 4-4z'

/** What a shape draws inside the shared `<Svg>`; `cut` is the detail colour inside a filled glyph. */
type Shape = (cut: string, filled: boolean) => ReactNode

const SHAPES = {
  home: (cut, filled) => (
    <>
      <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Polyline points="9 22 9 12 15 12 15 22" stroke={filled ? cut : undefined} />
    </>
  ),
  calendar: (cut, filled) => (
    <>
      <Rect x={3} y={4} width={18} height={18} rx={3} />
      <Line x1={16} y1={2} x2={16} y2={6} />
      <Line x1={8} y1={2} x2={8} y2={6} />
      <Line x1={3} y1={10} x2={21} y2={10} stroke={filled ? cut : undefined} />
    </>
  ),
  flag: () => (
    <>
      <Path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <Line x1={4} y1={22} x2={4} y2={15} />
    </>
  ),
  bookmark: () => <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />,
  user: () => (
    <>
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx={12} cy={7} r={4} />
    </>
  ),
  userOutline: () => (
    <>
      <Circle cx={12} cy={8} r={4} />
      <Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </>
  ),
  users: () => (
    <>
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <Circle cx={9} cy={7} r={4} />
      <Path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  chevronLeft: () => <Polyline points="15 18 9 12 15 6" />,
  chevronRight: () => <Polyline points="9 18 15 12 9 6" />,
  arrowRight: () => (
    <>
      <Line x1={5} y1={12} x2={19} y2={12} />
      <Polyline points="12 5 19 12 12 19" />
    </>
  ),
  mapPin: (cut, filled) => (
    <>
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <Circle cx={12} cy={10} r={3} stroke={filled ? cut : undefined} fill={filled ? cut : 'none'} />
    </>
  ),
  map: () => (
    <>
      <Polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <Line x1={8} y1={2} x2={8} y2={18} />
      <Line x1={16} y1={6} x2={16} y2={22} />
    </>
  ),
  navigation: () => <Polygon points="3 11 22 2 13 21 11 13 3 11" />,
  clock: () => (
    <>
      <Circle cx={12} cy={12} r={10} />
      <Polyline points="12 6 12 12 16 14" />
    </>
  ),
  dollar: () => (
    <>
      <Line x1={12} y1={1} x2={12} y2={23} />
      <Path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </>
  ),
  star: () => (
    <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  ),
  heart: () => (
    <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  ),
  check: () => <Polyline points="20 6 9 17 4 12" />,
  x: () => (
    <>
      <Line x1={18} y1={6} x2={6} y2={18} />
      <Line x1={6} y1={6} x2={18} y2={18} />
    </>
  ),
  plus: () => (
    <>
      <Line x1={12} y1={5} x2={12} y2={19} />
      <Line x1={5} y1={12} x2={19} y2={12} />
    </>
  ),
  copy: () => (
    <>
      <Rect x={9} y={9} width={13} height={13} rx={2} ry={2} />
      <Path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  share: () => (
    <>
      <Circle cx={18} cy={5} r={3} />
      <Circle cx={6} cy={12} r={3} />
      <Circle cx={18} cy={19} r={3} />
      <Line x1={8.59} y1={13.51} x2={15.42} y2={17.49} />
      <Line x1={15.41} y1={6.51} x2={8.59} y2={10.49} />
    </>
  ),
  zap: () => <Polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  search: () => (
    <>
      <Circle cx={11} cy={11} r={8} />
      <Line x1={21} y1={21} x2={16.65} y2={16.65} />
    </>
  ),
  /** A circled "i": information, not a warning (#292 room-update notice). */
  info: () => (
    <>
      <Circle cx={12} cy={12} r={10} />
      <Line x1={12} y1={16} x2={12} y2={12} />
      <Line x1={12} y1={8} x2={12.01} y2={8} />
    </>
  ),
  /** A warning: a fact the person should act on, always next to the words saying so. */
  alert: () => (
    <>
      <Path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <Line x1={12} y1={9} x2={12} y2={13} />
      <Line x1={12} y1={17} x2={12.01} y2={17} />
    </>
  ),
  /** Filters — three sliders. */
  sliders: () => (
    <>
      <Line x1={4} y1={21} x2={4} y2={14} />
      <Line x1={4} y1={10} x2={4} y2={3} />
      <Line x1={12} y1={21} x2={12} y2={12} />
      <Line x1={12} y1={8} x2={12} y2={3} />
      <Line x1={20} y1={21} x2={20} y2={16} />
      <Line x1={20} y1={12} x2={20} y2={3} />
      <Line x1={1} y1={14} x2={7} y2={14} />
      <Line x1={9} y1={8} x2={15} y2={8} />
      <Line x1={17} y1={16} x2={23} y2={16} />
    </>
  ),
  settings: () => (
    <>
      <Circle cx={12} cy={12} r={3} />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  bell: () => (
    <>
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </>
  ),
  inbox: () => (
    <>
      <Polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <Path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </>
  ),
  mail: () => (
    <>
      <Rect x={2} y={4} width={20} height={16} rx={2} />
      <Polyline points="22 6 12 13 2 6" />
    </>
  ),
  eye: () => (
    <>
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <Circle cx={12} cy={12} r={3} />
    </>
  ),
  eyeOff: () => (
    <>
      <Path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M6.61 6.61A18.5 18.5 0 0 0 1 12s4 8 11 8a9.1 9.1 0 0 0 5.39-1.61M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <Line x1={1} y1={1} x2={23} y2={23} />
    </>
  ),
  lock: () => (
    <>
      <Rect x={3} y={11} width={18} height={11} rx={2} ry={2} />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  unlock: () => (
    <>
      <Rect x={3} y={11} width={18} height={11} rx={2} ry={2} />
      <Path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </>
  ),
  moon: () => <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
  sun: () => (
    <>
      <Circle cx={12} cy={12} r={5} />
      <Line x1={12} y1={1} x2={12} y2={3} />
      <Line x1={12} y1={21} x2={12} y2={23} />
      <Line x1={4.22} y1={4.22} x2={5.64} y2={5.64} />
      <Line x1={18.36} y1={18.36} x2={19.78} y2={19.78} />
      <Line x1={1} y1={12} x2={3} y2={12} />
      <Line x1={21} y1={12} x2={23} y2={12} />
      <Line x1={4.22} y1={19.78} x2={5.64} y2={18.36} />
      <Line x1={18.36} y1={5.64} x2={19.78} y2={4.22} />
    </>
  ),
  sparkle: () => (
    <>
      <Path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <Path d="M19 16v4M17 18h4" />
    </>
  ),
  wifiOff: () => (
    <>
      <Line x1={1} y1={1} x2={23} y2={23} />
      <Path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <Path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <Path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
      <Path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <Path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <Line x1={12} y1={20} x2={12.01} y2={20} />
    </>
  ),
  // GoGo AI set (#378): history, new chat, composer, suggestions, menus and
  // states, in Feather geometry like the rest of the grid.
  history: () => (
    <>
      <Path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <Polyline points="3 3 3 8 8 8" />
      <Polyline points="12 7 12 12 15 14" />
    </>
  ),
  newChat: () => (
    <>
      <Path d="M12 20h9" />
      <Path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
    </>
  ),
  attach: () => (
    <Path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  ),
  mic: () => (
    <>
      <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <Line x1={12} y1={19} x2={12} y2={23} />
      <Line x1={8} y1={23} x2={16} y2={23} />
    </>
  ),
  send: () => (
    <>
      <Line x1={12} y1={19} x2={12} y2={5} />
      <Polyline points="5 12 12 5 19 12" />
    </>
  ),
  stop: () => <Rect x={6} y={6} width={12} height={12} rx={2} ry={2} fill="currentColor" />,
  compass: () => (
    <>
      <Circle cx={12} cy={12} r={10} />
      <Polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </>
  ),
  book: () => (
    <>
      <Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <Path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),
  support: () => (
    <>
      <Circle cx={12} cy={12} r={10} />
      <Circle cx={12} cy={12} r={4} />
      <Line x1={4.93} y1={4.93} x2={9.17} y2={9.17} />
      <Line x1={14.83} y1={14.83} x2={19.07} y2={19.07} />
      <Line x1={14.83} y1={9.17} x2={19.07} y2={4.93} />
      <Line x1={4.93} y1={19.07} x2={9.17} y2={14.83} />
    </>
  ),
  more: () => (
    <>
      <Circle cx={5} cy={12} r={1} />
      <Circle cx={12} cy={12} r={1} />
      <Circle cx={19} cy={12} r={1} />
    </>
  ),
  trash: () => (
    <>
      <Polyline points="3 6 5 6 21 6" />
      <Path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <Path d="M10 11v6M14 11v6" />
      <Path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </>
  ),
  retry: () => (
    <>
      <Polyline points="1 4 1 10 7 10" />
      <Path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </>
  ),
  doc: () => (
    <>
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Polyline points="14 2 14 8 20 8" />
      <Line x1={16} y1={13} x2={8} y2={13} />
      <Line x1={16} y1={17} x2={8} y2={17} />
    </>
  ),
  checkCircle: () => (
    <>
      <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <Polyline points="22 4 12 14.01 9 11.01" />
    </>
  ),
  /**
   * GoGo AI (#379): the chatbot symbol — a robot head drawn as a speech
   * bubble, with an antenna, two round eyes, a small smile and two ears.
   * Geometry copied from the GoGo AI design system (`Icon` `assistant`). The
   * solid avatar form is `AssistantGlyph` below.
   */
  assistant: () => (
    <>
      <Path d={ASSISTANT_BUBBLE} />
      <Line x1={12} y1={5} x2={12} y2={3.2} />
      <Circle cx={12} cy={2.2} r={1.1} fill="currentColor" />
      <Circle cx={8.8} cy={10} r={1.25} fill="currentColor" />
      <Circle cx={15.2} cy={10} r={1.25} fill="currentColor" />
      <Path d="M9.6 14q2.4 1.8 4.8 0" />
      <Line x1={1} y1={10.5} x2={1} y2={12.5} />
      <Line x1={23} y1={10.5} x2={23} y2={12.5} />
    </>
  ),
} satisfies Record<string, Shape>

export type IconName = keyof typeof SHAPES

const kebab = (name: string) => name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)

/** The one place an icon becomes an `<Svg>`: every glyph shares the grid and the stroke. */
function Glyph24({ name, size, color, cut, filled, testID }: {
  name: IconName
  size: number
  color: string
  cut: string
  filled: boolean
  testID?: string
}) {
  return (
    <Svg
      testID={testID ?? `icon-${kebab(name)}${filled ? '-filled' : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? color : 'none'}
      stroke={color}
      // `currentColor` in a shape (the assistant's eyes) resolves to this.
      color={color}
      strokeWidth={ICON_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {(SHAPES[name] as Shape)(cut, filled)}
    </Svg>
  )
}

/**
 * The icon primitive. `color` is a semantic role, never a value; `filled`
 * draws the solid form, which carries a state (saved, selected, active) by
 * shape as well as colour (RULE-DS). Decorative by default — the control it
 * sits in carries the accessible name.
 */
export function Icon({ name, size = 20, color = 'text.primary', filled = false, testID }: {
  name: IconName
  size?: number
  color?: TextColor
  filled?: boolean
  testID?: string
}) {
  const theme = useAppTheme()
  return <Glyph24 name={name} size={size} color={resolveColor(theme, color)} cut={theme.surface.card} filled={filled} testID={testID} />
}

/**
 * The assistant's face, solid (#379, GoGo AI design system `AssistantAvatar`):
 * the speech bubble filled, the eyes and smile cut out of it. No tile behind
 * it. Default: bubble `accent.primary`, face `accent.onAccent`, so it follows
 * "Màu chủ đề". `inverted` is for an accent ground (the float button): a
 * white bubble with an accent face. Strokes keep the shared `ICON_STROKE`.
 * Always decorative — "GoGo AI" is written or announced next to it.
 */
export function AssistantGlyph({ size, inverted = false, testID }: { size: number; inverted?: boolean; testID?: string }) {
  const theme = useAppTheme()
  const bubble = inverted ? theme.accent.onAccent : theme.accent.primary
  const face = inverted ? theme.accent.primary : theme.accent.onAccent
  return (
    <Svg
      testID={testID ?? (inverted ? 'assistant-glyph-inverted' : 'assistant-glyph')}
      width={size}
      height={size}
      viewBox="0 0 24 24"
    >
      <Line x1={12} y1={5.5} x2={12} y2={3} stroke={bubble} strokeWidth={ICON_STROKE} strokeLinecap="round" />
      <Circle cx={12} cy={2.2} r={1.4} fill={bubble} />
      <Path d={ASSISTANT_BUBBLE} fill={bubble} stroke={bubble} strokeWidth={ICON_STROKE} strokeLinejoin="round" />
      <Circle cx={8.8} cy={10.2} r={1.5} fill={face} />
      <Circle cx={15.2} cy={10.2} r={1.5} fill={face} />
      <Path d="M9.4 13.7q2.6 2 5.2 0" fill="none" stroke={face} strokeWidth={ICON_STROKE} strokeLinecap="round" />
    </Svg>
  )
}

// ---------------------------------------------------------------------------
// Named icons. They predate `Icon` and their callers pass a colour already
// read from the theme (`theme.accent.primary`); they draw through the same
// grid, and their defaults are theme roles. New code uses `Icon`.
// ---------------------------------------------------------------------------

/**
 * Tab icons (#296, #293 §5): the active tab is a *filled* glyph in the accent,
 * an inactive one an outline in `text.secondary`. Shape, not only colour,
 * carries the state (RULE-DS), and the outline clears 3:1 as a UI glyph on the
 * bar's wash.
 */
function useTabIconColors(active?: boolean) {
  const theme = useAppTheme()
  return {
    tint: active ? theme.accent.text : theme.text.secondary,
    /** Detail drawn inside a filled glyph — the door, the calendar rule. */
    cut: theme.accent.onAccent,
  }
}

export function IconHome({ active }: { active?: boolean }) {
  const { tint, cut } = useTabIconColors(active)
  return <Glyph24 name="home" size={22} color={tint} cut={cut} filled={active === true} />
}

export function IconCalendar({ active }: { active?: boolean }) {
  const { tint, cut } = useTabIconColors(active)
  return <Glyph24 name="calendar" size={22} color={tint} cut={cut} filled={active === true} />
}

/**
 * Tab icon (`active`) and the save toggle (`filled`). Saved is a filled glyph,
 * not only a colour, so the state survives colour blindness (RULE-DS).
 */
export function IconBookmark({ active, filled = false, size = 22, color }: {
  active?: boolean
  filled?: boolean
  size?: number
  color?: string
}) {
  const theme = useAppTheme()
  const { tint, cut } = useTabIconColors(active)
  const solid = filled || active === true
  return <Glyph24 name="bookmark" size={size} color={color ?? (filled ? theme.accent.primary : tint)} cut={cut} filled={solid} />
}

export function IconUser({ active }: { active?: boolean }) {
  const { tint, cut } = useTabIconColors(active)
  return <Glyph24 name="user" size={22} color={tint} cut={cut} filled={active === true} />
}

/** Shared body of the named icons below: a theme default, a size, an optional override. */
function useNamed(color: string | undefined, fallback: (theme: ReturnType<typeof useAppTheme>) => string) {
  const theme = useAppTheme()
  return { color: color ?? fallback(theme), cut: theme.surface.card }
}

export function IconChevronLeft({ color }: { color?: string } = {}) {
  const c = useNamed(color, theme => theme.text.primary)
  return <Glyph24 name="chevronLeft" size={20} {...c} filled={false} />
}

/** A row's disclosure glyph — `text.secondary`, which clears 3:1 on a card and on the canvas. */
export function IconChevronRight({ color }: { color?: string } = {}) {
  const c = useNamed(color, theme => theme.text.secondary)
  return <Glyph24 name="chevronRight" size={16} {...c} filled={false} />
}

export function IconMapPin({ color, size = 16 }: { color?: string; size?: number }) {
  const c = useNamed(color, theme => theme.accent.primary)
  return <Glyph24 name="mapPin" size={size} {...c} filled={false} />
}

export function IconClock({ color }: { color?: string }) {
  const c = useNamed(color, theme => theme.text.secondary)
  return <Glyph24 name="clock" size={14} {...c} filled={false} />
}

export function IconDollar({ color }: { color?: string }) {
  const c = useNamed(color, theme => theme.text.secondary)
  return <Glyph24 name="dollar" size={14} {...c} filled={false} />
}

export function IconStar() {
  const c = useNamed(undefined, theme => theme.accent.primary)
  return <Glyph24 name="star" size={12} {...c} filled />
}

export function IconCheck({ color, size = 16 }: { color?: string; size?: number }) {
  const c = useNamed(color, theme => theme.status.successText)
  return <Glyph24 name="check" size={size} {...c} filled={false} />
}

/** Two offset sheets — the copy glyph every platform uses. */
export function IconCopy({ color, size = 18 }: { color?: string; size?: number }) {
  const c = useNamed(color, theme => theme.text.secondary)
  return <Glyph24 name="copy" size={size} {...c} filled={false} />
}

export function IconShare({ color }: { color?: string }) {
  const c = useNamed(color, theme => theme.accent.onAccent)
  return <Glyph24 name="share" size={18} {...c} filled={false} />
}

export function IconArrowRight({ color }: { color?: string }) {
  const c = useNamed(color, theme => theme.text.secondary)
  return <Glyph24 name="arrowRight" size={18} {...c} filled={false} />
}

export function IconNavigation({ color }: { color?: string }) {
  const c = useNamed(color, theme => theme.accent.primary)
  return <Glyph24 name="navigation" size={16} {...c} filled />
}

export function IconZap() {
  const c = useNamed(undefined, theme => theme.accent.primary)
  return <Glyph24 name="zap" size={16} {...c} filled />
}

export function IconSearch() {
  const c = useNamed(undefined, theme => theme.text.secondary)
  return <Glyph24 name="search" size={16} {...c} filled={false} />
}

export function IconUserOutline() {
  const c = useNamed(undefined, theme => theme.text.secondary)
  return <Glyph24 name="userOutline" size={20} {...c} filled={false} />
}

/** A circled "i": information, not a warning (#292 room-update notice). */
export function IconInfo({ color, size = 16 }: { color: string; size?: number }) {
  const c = useNamed(color, theme => theme.text.secondary)
  return <Glyph24 name="info" size={size} {...c} filled={false} />
}
