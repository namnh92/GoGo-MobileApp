import Svg, { Path } from 'react-native-svg'
import { useUnistyles } from 'react-native-unistyles'
import { resolveColor, type TextColor } from './text'

/** Material Symbols, 24-unit outline grid, as used in the approved redesign. */
const paths = {
  storefront: 'M3 2h18l2 7v2a4 4 0 0 1-2 3.5V22H3v-7.5A4 4 0 0 1 1 11V9zm1.5 2L3 9h18l-1.5-5zM3 11a2 2 0 0 0 4 0zm6 0a2 2 0 0 0 4 0zm6 0a2 2 0 0 0 4 0zM5 15v5h3v-4h8v4h3v-5a4 4 0 0 1-5-1 4 4 0 0 1-6 0 4 4 0 0 1-3 1z',
  addLocation: 'M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 2a5 5 0 0 1 5 5c0 3-3 7-5 10-2-3-5-7-5-10a5 5 0 0 1 5-5zm-1 2h2v2h2v2h-2v2h-2v-2H9V8h2z',
  filterList: 'M3 5h18v2H3zm3 6h12v2H6zm4 6h4v2h-4z',
  filterOff: 'M2.4 1L23 21.6 21.6 23l-8.6-8.6V21h-2v-8.6L1 2.4zM6 3h16v2l-6 7-1.4-1.4L19 5H8z',
  travelExplore: 'M10 2a8 8 0 1 0 0 16 8 8 0 0 0 3.8-1l6.8 6.8L22 22.4 15.2 15.6A8 8 0 0 0 10 2zm0 2a6 6 0 0 1 5.9 5H12V4.3zm-2 .3V9H4.1A6 6 0 0 1 8 4.3zM4.1 11H8v4.7A6 6 0 0 1 4.1 11zm7.9 0h3.9a6 6 0 0 1-3.9 4.7z',
  payments: 'M2 6h20v14H2zm2 2v10h16V8zm8 1a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM0 3h19v2H2v12H0z',
  nearMe: 'M21 3L3 10.5v1.4l7.1 2.9 2.9 7.1h1.4L22 4zm-6.7 15.7l-2.2-5.4-5.4-2.2 12-5z',
  expandMore: 'M6.4 8.6L12 14.2l5.6-5.6L19 10l-7 7-7-7z',
  chevronRight: 'M8.6 5L7.2 6.4l5.6 5.6-5.6 5.6L8.6 19l7-7z',
  groups: 'M16 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM6 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm10 1c-3 0-8 1.5-8 4v4h16v-4c0-2.5-5-4-8-4zM6 14c-2 0-6 1-6 3v4h6v-4c0-1 .4-2 1-3z',
  search: 'M9.5 3a6.5 6.5 0 1 0 4.1 11.5L20 21l1-1-6.5-6.4A6.5 6.5 0 0 0 9.5 3zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z',
  tune: 'M3 6h10V4h2v2h6v2h-6v2h-2V8H3zm0 10h4v-2h2v2h12v2H9v2H7v-2H3z',
  list: 'M3 5h2v2H3zm4 0h14v2H7zM3 11h2v2H3zm4 0h14v2H7zM3 17h2v2H3zm4 0h14v2H7z',
  map: 'M2 4l7-2 6 2 7-2v18l-7 2-6-2-7 2zm2 1.5v14L8 18V4.5zm6-1v14l4 1.3v-14zm6 1.2v14l4-1.2v-14z',
  location: 'M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 2a5 5 0 0 1 5 5c0 3-3 7-5 10-2-3-5-7-5-10a5 5 0 0 1 5-5zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  explore: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm5 3-7 3-3 7 7-3zm-5 3.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z',
  plus: 'M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z',
  restart: 'M12 4a8 8 0 1 1-8 8h2a6 6 0 1 0 6-6H8l3 3-1.4 1.4L4.2 5l5.4-5.4L11 1 8 4z',
  arrowRight: 'M12 20l-1.4-1.4 5.6-5.6H4v-2h12.2l-5.6-5.6L12 4l8 8z',
  arrowBack: 'M12 20l-8-8 8-8 1.4 1.4L7.8 11H20v2H7.8l5.6 5.6z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0-2a2 2 0 1 1 0-4 2 2 0 0 1 0 4zM4 20v-3c0-3 5.3-4 8-4s8 1 8 4v3zm2-2h12v-1c0-1-3.4-2-6-2s-6 1-6 2z',
  lock: 'M6 22a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2h1V6a5 5 0 0 1 10 0v2h1a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2zm0-2h12V10H6zm3-12h6V6a3 3 0 0 0-6 0zm3 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  mail: 'M12 22A10 10 0 1 1 22 12v1a4 4 0 0 1-7.1 2.5A5 5 0 1 1 17 12v1a2 2 0 0 0 4 0v-1a9 9 0 1 0-9 9h5v1zm0-7a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  coffee: 'M3 22v-2h18v2zm8-4a8 8 0 0 1-8-8V2h16a4 4 0 1 1 0 8h-1a7 7 0 0 1-7 8zm-6-8a6 6 0 0 0 12 0V4H5zm14-2a2 2 0 0 0 0-4z',
  room: 'M3 22v-2h2V2h14v18h2v2zm4-2h10V4H7zm6-7h2v-2h-2z',
  badge: 'M4 22V4h5V1h6v3h5v18zm2-2h12V6h-3v2H9V6H6zm5-14h2V3h-2zm1 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-4 4h8v-1c0-2-8-2-8 0z',
  eye: 'M12 20C6 20 2 16 0 12 2 8 6 4 12 4s10 4 12 8c-2 4-6 8-12 8zm0-2c4.5 0 8-3 9.7-6C20 9 16.5 6 12 6s-8 3-9.7 6C4 15 7.5 18 12 18zm0-1a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0-2a3 3 0 1 1 0-6 3 3 0 0 1 0 6z',
  eyeOff: 'M2 1l21 21-1.4 1.4L.6 2.4zm10 3c6 0 10 4 12 8a19 19 0 0 1-4 5l-1.4-1.4a16 16 0 0 0 3.1-3.6C20 9 16.5 6 12 6h-1L9 4.2zM1 10l1.5 1.5-.2.5C4 15 7.5 18 12 18h2l1.7 1.7A14 14 0 0 1 12 20C6 20 2 16 0 12z',
  info: 'M11 17h2v-6h-2zm1-8a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm0 13a10 10 0 1 1 0-20 10 10 0 0 1 0 20zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  checkCircle: 'M10.6 16.6L18 9.2l-1.4-1.4-6 6L7.4 10.6 6 12zm1.4 5.4a10 10 0 1 1 0-20 10 10 0 0 1 0 20zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  verified: 'M8 2l4 2 4-2 2 4 4 2-2 4 2 4-4 2-2 4-4-2-4 2-2-4-4-2 2-4-2-4 4-2zm1 2.7L7.5 7.5 4.7 9 6 12l-1.3 3 2.8 1.5L9 19.3l3-1.3 3 1.3 1.5-2.8 2.8-1.5-1.3-3 1.3-3-2.8-1.5L15 4.7 12 6zm1.5 11.8L7 13l1.4-1.4 2.1 2.1 5.1-5.1L17 10z',
  heart: 'M12 21l-1.5-1.4C5.2 14.8 2 11.9 2 8.3A5.4 5.4 0 0 1 12 5.4a5.4 5.4 0 0 1 10 2.9c0 3.6-3.2 6.5-8.5 11.3zm0-2.7C17 13.8 20 11.1 20 8.3a3.4 3.4 0 0 0-6.4-1.5L12 9l-1.6-2.2A3.4 3.4 0 0 0 4 8.3c0 2.8 3 5.5 8 10z',
  bookmark: 'M6 22V2h12v20l-6-3zm2-3.2l4-2 4 2V4H8z',
  close: 'M6.4 19L5 17.6l5.6-5.6L5 6.4 6.4 5l5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6z',
  bolt: 'M11 22v-8H5l8-12v8h6zm2-6.6l2.3-3.4H11V8.6L8.7 12H13z',
  clock: 'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.3-3.3L11 12.4V6h2v5.6l3.7 3.7z',
  timerOff: 'M9 1h6v2H9zm3 3a9 9 0 0 1 9 9 9 9 0 0 1-1.4 4.8l-1.5-1.5A7 7 0 0 0 7.7 6.9L6.2 5.4A9 9 0 0 1 12 4zM1.4 1L23 22.6 21.6 24 0 2.4zm3 8l1.5 1.5A7 7 0 0 0 16.5 19l1.5 1.5A9 9 0 0 1 4.4 9z',
  touch: 'M9 13V5a3 3 0 0 1 6 0v6l5 2v6l-3 4h-6L4 16l2-2 3 2zm2 7h5l2-2v-4l-5-2V5a1 1 0 0 0-2 0v13l-5-2zm-6-12a7 7 0 0 1 14 0h-2a5 5 0 0 0-10 0z',
  walk: 'M14 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm-4 1l4 1 2 4 4 2-1 2-5-3-1-2-1 5 4 3v5h-2v-4l-4-3-2 7H6l3-12-3 2v3H4v-4z',
  sparkle: 'M9 1l2.5 6.5L18 10l-6.5 2.5L9 19l-2.5-6.5L0 10l6.5-2.5zm0 5L8 9l-3 1 3 1 1 3 1-3 3-1-3-1zm11 8l1 3 3 1-3 1-1 3-1-3-3-1 3-1z',
} as const

export type MaterialIconName = keyof typeof paths
export function MaterialIcon({ name, size = 20, color = 'redesign.ink' }: {
  name: MaterialIconName; size?: number; color?: TextColor
}) {
  const { theme } = useUnistyles()
  return <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden><Path d={paths[name]} fill={resolveColor(theme, color)} fillRule="evenodd" /></Svg>
}
