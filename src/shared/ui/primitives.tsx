import { Image } from 'expo-image'
import type { ReactNode } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useLocaleContent } from '@/shared/i18n'
import { IconChevronLeft } from '@/shared/ui/icons'
import { colors, radius, spacing, touchTarget } from '@/shared/ui/tokens'

const { brand, neutral } = colors

// RN has no backdrop blur without a native module, so glass uses the opaque
// warm fallback (spec §43.4/§48.3): hierarchy and semantics, not the effect.
export const glassStyles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    shadowColor: '#362D26',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  strong: {
    backgroundColor: 'rgba(252,251,248,0.96)',
    borderColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    shadowColor: '#362D26',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.13,
    shadowRadius: 24,
    elevation: 6,
  },
})

export function GlassCard({ children, style, strong = false }: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  strong?: boolean
}) {
  return (
    <View style={[strong ? glassStyles.strong : glassStyles.card, { borderRadius: radius.card }, style]}>
      {children}
    </View>
  )
}

/** Warm atmosphere background (spec §42.3) — soft brand blobs over ivory. */
export function Atmosphere({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.atmosphereRoot, style]}>
      <View style={[styles.blob, { top: -60, left: -70, backgroundColor: brand.coralBright, opacity: 0.14 }]} />
      <View style={[styles.blob, { top: 40, right: -90, backgroundColor: brand.lavender, opacity: 0.1 }]} />
      <View style={[styles.blob, { bottom: -80, left: '30%', backgroundColor: brand.mint, opacity: 0.08 }]} />
      {children}
    </View>
  )
}

export function PrimaryBtn({ label, onPress, disabled = false, style }: {
  label: string
  onPress: () => void
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.primaryBtn,
        pressed && { transform: [{ scale: 0.98 }] },
        disabled && { backgroundColor: neutral[100] },
        style,
      ]}
    >
      <Text style={[styles.primaryBtnLabel, disabled && { color: neutral[300] }]}>{label}</Text>
    </Pressable>
  )
}

export function GhostBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.7 }]}>
      <Text style={styles.ghostBtnLabel}>{label}</Text>
    </Pressable>
  )
}

export type TagColor = 'coral' | 'violet' | 'green' | 'neutral'

const tagPalette: Record<TagColor, { bg: string; fg: string }> = {
  coral: { bg: brand.coralSoft, fg: brand.coral },
  violet: { bg: brand.lavenderSoft, fg: brand.lavender },
  green: { bg: brand.mintSoft, fg: brand.mint },
  neutral: { bg: neutral[100], fg: neutral[500] },
}

// Canonical tag keys live in mock data; display label is locale-mapped here.
export function TagChip({ label, color = 'neutral' }: { label: string; color?: TagColor }) {
  const { tagLabels } = useLocaleContent()
  const palette = tagPalette[color]
  return (
    <View style={[styles.tag, { backgroundColor: palette.bg }]}>
      <Text style={[styles.tagLabel, { color: palette.fg }]}>{tagLabels[label] ?? label}</Text>
    </View>
  )
}

export function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[styles.dot, i === current && styles.dotActive]} />
      ))}
    </View>
  )
}

export function BackHeader({ title, onBack, right }: { title?: string; onBack: () => void; right?: ReactNode }) {
  const { t } = useTranslation()
  return (
    <View style={styles.backHeader}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        style={({ pressed }) => [styles.backBtn, glassStyles.card, pressed && { opacity: 0.7 }]}
      >
        <IconChevronLeft />
      </Pressable>
      {title ? <Text style={styles.backTitle}>{title}</Text> : null}
      {right ?? <View style={{ width: 36 }} />}
    </View>
  )
}

export function AvatarCircle({ label, size = 40, background = brand.coral, emoji }: {
  label?: string
  size?: number
  background?: string
  emoji?: string
}) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: emoji ? neutral[100] : background }]}>
      <Text style={emoji ? { fontSize: size * 0.45 } : [styles.avatarLabel, { fontSize: size * 0.38 }]}>
        {emoji ?? label}
      </Text>
    </View>
  )
}

export function RemoteImage({ uri, style }: { uri: string; style?: StyleProp<ViewStyle> }) {
  return <Image source={{ uri }} style={[{ backgroundColor: neutral[100] }, style as object]} contentFit="cover" transition={150} />
}

/** Fixed toast near the top of the screen — `role=status` equivalent. */
export function Toast({ message }: { message: string }) {
  const insets = useSafeAreaInsets()
  return (
    <View accessibilityLiveRegion="polite" style={[styles.toast, { top: insets.top + spacing[6] }]}>
      <Text style={styles.toastLabel}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  atmosphereRoot: {
    flex: 1,
    backgroundColor: neutral[50],
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
  },
  primaryBtn: {
    height: 56,
    borderRadius: radius.button,
    backgroundColor: brand.coral,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: brand.coral,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 5,
  },
  primaryBtnLabel: {
    color: neutral[0],
    fontSize: 16,
    fontWeight: '600',
  },
  ghostBtn: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnLabel: {
    color: neutral[500],
    fontSize: 15,
    fontWeight: '500',
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  tagLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    height: 6,
    width: 6,
    borderRadius: 3,
    backgroundColor: neutral[100],
  },
  dotActive: {
    width: 20,
    backgroundColor: brand.coral,
  },
  backHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
  },
  backBtn: {
    width: 36,
    height: 36,
    minWidth: touchTarget.min - 8,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: neutral[900],
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    color: neutral[0],
    fontWeight: '700',
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: neutral[900],
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.compact,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  toastLabel: {
    color: neutral[0],
    fontSize: 13,
    fontWeight: '600',
  },
})
