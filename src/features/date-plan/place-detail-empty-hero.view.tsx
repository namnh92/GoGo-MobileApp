import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { useUnistyles } from 'react-native-unistyles'

/**
 * The "no photo" hero: a small shop on a soft ground, drawn from theme tokens so
 * it follows light, dark and the accent. Decorative; the caption beside it says
 * what it means.
 */
export function PlaceDetailEmptyHero() {
  const { theme } = useUnistyles()
  const accent = theme.accent.primary
  return (
    <Svg width="100%" height="100%" viewBox="0 0 358 260" preserveAspectRatio="xMidYMid slice" fill="none">
      <Circle cx={300} cy={44} r={46} fill={accent} fillOpacity={0.08} />
      <Circle cx={44} cy={226} r={60} fill={accent} fillOpacity={0.06} />
      <Path
        d="M0 206 C80 176 150 232 224 200 S330 178 358 196"
        stroke={accent}
        strokeOpacity={0.22}
        strokeWidth={2}
        strokeDasharray="4 7"
      />
      <Rect x={129} y={96} width={100} height={72} rx={8} fill={theme.surface.card} stroke={theme.text.secondary} strokeOpacity={0.5} strokeWidth={2} />
      <Path d="M121 96 L135 72 H223 L237 96 Z" fill={accent} fillOpacity={0.9} />
      <Rect x={146} y={118} width={24} height={50} rx={3} fill={theme.surface.subtle} />
      <Rect x={182} y={118} width={32} height={24} rx={3} fill={theme.surface.subtle} />
    </Svg>
  )
}
