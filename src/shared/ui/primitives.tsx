import { Image, type ImageProps } from 'expo-image'
import { type ReactNode } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { useLocaleContent } from '@/shared/i18n'
import { AmbientGlow } from './ambient-glow.view'
import { Chip } from './chip.view'

export { DangerBtn, GhostBtn, IconBtn, PrimaryBtn, SecondaryBtn, type ButtonProps } from '@/shared/ui/button.view'
export { Card } from '@/shared/ui/card.view'
export { useBottomBarInset } from '@/shared/ui/bottom-bar-inset'
export { Toast } from '@/shared/ui/toast.view'

/**
 * Card look for the call sites that still spread it into their own style
 * arrays (remaining call sites, one of them a Reanimated view). Solid, no
 * accent; it reads the theme, so it follows the device into dark. #298 removed
 * the `GlassCard` alias only; this goes with its last importer.
 *
 * @deprecated Use `Card`.
 */
export const glassStyles = StyleSheet.create(theme => ({
  card: {
    backgroundColor: theme.surface.card,
    borderWidth: 1,
    borderColor: theme.border.hairline,
    ...theme.shadows.card,
  },
  strong: {
    backgroundColor: theme.surface.card,
    borderWidth: 1,
    borderColor: theme.border.hairline,
    ...theme.shadows.card,
  },
}))

/**
 * The screen canvas. It used to be colour blobs under a full-screen blur; #293
 * replaces that with a flat `surface.canvas`, which is also what the design
 * system asks of a background — no full-screen blur, contrast never depending
 * on the layer behind (RULE-DS).
 */
export function Atmosphere({ children, style, redesign = false, glow = false }: { children: ReactNode; style?: StyleProp<ViewStyle>; redesign?: boolean; glow?: boolean }) {
  return <View style={[styles.canvas, redesign && styles.redesignCanvas, style]}>{glow && <AmbientGlow />}{children}</View>
}

export type TagColor = 'coral' | 'violet' | 'green' | 'neutral'

export { Chip, type ChipVariant } from './chip.view'

// Canonical tag keys live in mock data; display label is locale-mapped here.
export function TagChip({ label, color = 'neutral' }: { label: string; color?: TagColor }) {
  const { tagLabels } = useLocaleContent()
  return <Chip label={tagLabels[label] ?? label} variant={color === 'violet' ? 'info' : color === 'green' ? 'positive' : 'default'} />
}

export function ProgressDots({ total, current, variant = 'default' }: { total: number; current: number; variant?: 'default' | 'debate' | 'swipe' | 'plan' }) {
  return (
    <View style={[styles.dotsRow, variant !== 'default' && styles.redesignDotsRow, variant === 'debate' && styles.debateDotsRow]}>
      {Array.from({ length: total }).map((_, i) => (
        <View testID={`progress-dot-${i}`} key={i} style={[styles.dot, variant !== 'default' && styles.redesignDot, variant === 'swipe' && styles.swipeDot, variant === 'plan' && styles.planDot, i === current && styles.dotActive, i === current && variant !== 'default' && styles.redesignDotActive]} />
      ))}
    </View>
  )
}

export { AvatarCircle } from './avatar-circle.view'

type RemoteImageProps = (
  | { uri: string; source?: never }
  | { source: NonNullable<ImageProps['source']>; uri?: never }
) & { style?: StyleProp<ViewStyle>; illustration?: boolean }

export function RemoteImage({ uri, source, style, illustration = false }: RemoteImageProps) {
  const { theme } = useUnistyles()
  return <Image cachePolicy="memory-disk" source={source !== undefined ? source : { uri, cacheKey: uri }} style={[{ backgroundColor: illustration ? theme.surface.low : theme.surface.subtle }, style as object]} contentFit={illustration ? 'contain' : 'cover'} transition={illustration ? 0 : 150} />
}

const styles = StyleSheet.create(theme => ({
  redesignCanvas: { backgroundColor: theme.surface.canvas },
  redesignDotsRow: { gap: 8 },
  debateDotsRow: { gap: 4 },
  redesignDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.surface.highest },
  swipeDot: { backgroundColor: theme.border.hairline, opacity: 0.6 },
  planDot: { backgroundColor: theme.surface.dim },
  redesignDotActive: { width: 24, backgroundColor: theme.accent.primary, opacity: 1 },
  canvas: { flex: 1, backgroundColor: theme.surface.canvas },



  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    height: 6,
    width: 6,
    borderRadius: 3,
    backgroundColor: theme.surface.subtle,
  },
  dotActive: {
    width: 20,
    backgroundColor: theme.accent.primary,
  },

}))
