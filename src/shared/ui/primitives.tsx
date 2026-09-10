import { isLiquidGlassSupported, LiquidGlassView } from '@callstack/liquid-glass'
import { BlurView } from 'expo-blur'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Platform,
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
import { haptic } from '@/shared/ui/feedback'
import { colors, glass, glassFx, hitSlop, radius, shadows, spacing, touchTarget, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

// Warm Liquid Glass (spec §43): translucent surfaces over a strong atmosphere.
// One full-screen BlurView softens the color blobs into radial-gradient light;
// per-card blur stays off lists for performance (spec §48.1).
export const glassStyles = StyleSheet.create({
  card: {
    backgroundColor: glass.regular.background,
    borderColor: glassFx.border,
    borderWidth: 1,
    shadowColor: shadows.warm,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  strong: {
    backgroundColor: glassFx.chip,
    borderColor: glass.strong.border,
    borderWidth: 1,
    shadowColor: shadows.warm,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.13,
    shadowRadius: 24,
  },
})

export function GlassCard({ children, style, strong = false, interactive = false }: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  strong?: boolean
  interactive?: boolean
}) {
  // Native Liquid Glass on iOS 26+ (@callstack/liquid-glass); translucent
  // solid fallback elsewhere — never depend on the effect for readability.
  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView
        effect="regular"
        colorScheme="light"
        interactive={interactive}
        tintColor={strong ? glassFx.nativeTintStrong : glass.subtle.background}
        style={[{ borderRadius: radius.card }, style]}
      >
        {children}
      </LiquidGlassView>
    )
  }
  return (
    <View style={[strong ? glassStyles.strong : glassStyles.card, { borderRadius: radius.card }, style]}>
      {children}
    </View>
  )
}

/** Warm atmosphere (spec §42.3): coral/lavender/mint light blobs under a soft
 *  blur so they read as radial gradients, over the ivory base. */
export function Atmosphere({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.atmosphereRoot, style]}>
      {Platform.OS === 'android' ? (
        <LinearGradient
          pointerEvents="none"
          colors={[brand.coralSoft, neutral[50], brand.lavenderSoft]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.blob, { top: -110, left: -90, width: 380, height: 380, borderRadius: 190, backgroundColor: brand.coralBright, opacity: 0.4 }]} />
        <View style={[styles.blob, { top: -40, right: -120, width: 360, height: 360, borderRadius: 180, backgroundColor: brand.lavender, opacity: 0.3 }]} />
        <View style={[styles.blob, { top: '38%', right: -140, width: 300, height: 300, borderRadius: 150, backgroundColor: brand.lavenderSoft, opacity: 0.55 }]} />
        <View style={[styles.blob, { bottom: -120, left: '22%', width: 360, height: 360, borderRadius: 180, backgroundColor: brand.mint, opacity: 0.22 }]} />
        <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFill} />
      </View>}
      {children}
    </View>
  )
}

/**
 * The button family (spec §7). One dominant `PrimaryBtn` per screen; everything
 * else is secondary, ghost, danger or icon-only. They share a height, a radius
 * and a pressed transform so a screen never looks like it borrowed a control
 * from somewhere else.
 */

interface ButtonProps {
  label: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  style?: StyleProp<ViewStyle>
}

/** Press feedback: the same scale everywhere, plus one haptic tick. */
function pressHandler(onPress: () => void, kind: Parameters<typeof haptic>[0] = 'select') {
  return () => {
    haptic(kind)
    onPress()
  }
}

export function PrimaryBtn({ label, onPress, disabled = false, loading = false, style }: ButtonProps) {
  // A CTA in flight must not fire twice; the spinner replaces the label rather
  // than sitting beside it so the button never changes width mid-press.
  const inactive = disabled || loading
  return (
    <Pressable
      onPress={pressHandler(onPress, 'impact')}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [styles.primaryBtnShadow, pressed && styles.pressed, style]}
    >
      <LinearGradient
        colors={inactive ? [neutral[100], neutral[100]] : [brand.coralDeep, brand.coralInk]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryBtn}
      >
        {loading ? (
          <ActivityIndicator color={neutral[500]} />
        ) : (
          <Text
            style={[styles.primaryBtnLabel, inactive && { color: neutral[300] }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            {label}
          </Text>
        )}
      </LinearGradient>
    </Pressable>
  )
}

/**
 * The second action on a screen. Outlined rather than filled, so the eye still
 * lands on the primary — two filled CTAs side by side have no hierarchy at all.
 */
export function SecondaryBtn({ label, onPress, disabled = false, loading = false, style }: ButtonProps) {
  const inactive = disabled || loading
  return (
    <Pressable
      onPress={pressHandler(onPress)}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [styles.secondaryBtn, inactive && styles.inactive, pressed && styles.pressed, style]}
    >
      {loading ? (
        <ActivityIndicator color={brand.coral} />
      ) : (
        <Text
          style={styles.secondaryBtnLabel}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {label}
        </Text>
      )}
    </Pressable>
  )
}

export function GhostBtn({ label, onPress, disabled = false, style }: Omit<ButtonProps, 'loading'>) {
  return (
    <Pressable
      onPress={pressHandler(onPress)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.ghostBtn, disabled && styles.inactive, pressed && { opacity: 0.7 }, style]}
    >
      <Text style={styles.ghostBtnLabel}>{label}</Text>
    </Pressable>
  )
}

/** Destructive and irreversible — never the default action on a screen. */
export function DangerBtn({ label, onPress, disabled = false, loading = false, style }: ButtonProps) {
  const inactive = disabled || loading
  return (
    <Pressable
      onPress={pressHandler(onPress, 'warning')}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [styles.dangerBtn, inactive && styles.inactive, pressed && styles.pressed, style]}
    >
      {loading ? (
        <ActivityIndicator color={brand.red} />
      ) : (
        <Text style={styles.dangerBtnLabel} numberOfLines={1}>{label}</Text>
      )}
    </Pressable>
  )
}

/**
 * Icon-only. The glyph is not a label, so `accessibilityLabel` is required —
 * a screen reader announcing "button" and nothing else is a dead end. Drawn at
 * 40pt with slop so the touch area still clears 44 (RULE-DS touch targets).
 */
export function IconBtn({ children, onPress, accessibilityLabel, active = false, disabled = false, style }: {
  children: ReactNode
  onPress: () => void
  accessibilityLabel: string
  active?: boolean
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}) {
  return (
    <Pressable
      onPress={pressHandler(onPress)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected: active }}
      hitSlop={hitSlop}
      style={({ pressed }) => [
        styles.iconBtn,
        active ? styles.iconBtnActive : glassStyles.card,
        disabled && styles.inactive,
        pressed && styles.pressed,
        style,
      ]}
    >
      {children}
    </Pressable>
  )
}

export type TagColor = 'coral' | 'violet' | 'green' | 'neutral'

const tagPalette: Record<TagColor, { bg: string; fg: string }> = {
  coral: { bg: brand.coralSoft, fg: brand.coral },
  violet: { bg: brand.lavenderSoft, fg: brand.lavender },
  green: { bg: brand.mintSoft, fg: brand.mint },
  neutral: { bg: glassFx.neutralChip, fg: neutral[500] },
}

/**
 * Chip states (spec §7). `selected` is the only interactive one; the rest are
 * read-only meaning. Selection is never colour alone — it also carries a check
 * and a heavier weight, because roughly one man in twelve cannot tell the
 * coral fill from the neutral one (RULE-DS colour-is-not-the-only-signal).
 */
export type ChipVariant = 'default' | 'selected' | 'disabled' | 'info' | 'positive' | 'warning'

const chipPalette: Record<ChipVariant, { bg: string; fg: string; border?: string }> = {
  default: { bg: glassFx.chip, fg: neutral[700], border: neutral[100] },
  selected: { bg: brand.coral, fg: neutral[0], border: brand.coral },
  disabled: { bg: neutral[50], fg: neutral[300], border: neutral[100] },
  info: { bg: brand.lavenderSoft, fg: brand.lavender },
  positive: { bg: brand.mintSoft, fg: brand.mint },
  warning: { bg: brand.amberSoft, fg: brand.amber },
}

export function Chip({ label, variant = 'default', icon, onPress, accessibilityLabel, style }: {
  label: string
  variant?: ChipVariant
  /** Emoji or short glyph rendered before the label. */
  icon?: string
  onPress?: () => void
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}) {
  const palette = chipPalette[variant]
  const selected = variant === 'selected'
  const disabled = variant === 'disabled'

  const body = (
    <View
      style={[
        styles.chip,
        { backgroundColor: palette.bg, borderColor: palette.border ?? palette.bg },
        style,
      ]}
    >
      {icon ? <Text style={styles.chipIcon}>{icon}</Text> : null}
      <Text style={[styles.chipLabel, { color: palette.fg }, selected && styles.chipLabelSelected]} numberOfLines={1}>
        {selected ? `✓ ${label}` : label}
      </Text>
    </View>
  )

  if (!onPress) return body

  return (
    <Pressable
      onPress={() => {
        haptic('select')
        onPress()
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      hitSlop={hitSlop}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  )
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
        hitSlop={hitSlop}
        style={({ pressed }) => [styles.backBtn, glassStyles.card, pressed && { opacity: 0.7 }]}
      >
        <IconChevronLeft />
      </Pressable>
      {title ? <Text style={styles.backTitle}>{title}</Text> : null}
      {right ?? <View style={{ width: 36 }} />}
    </View>
  )
}

/**
 * One avatar for every surface (RULE-CORE-015). `imageUri` is the profile
 * picture the API composed (ADR-0022); when it is absent, or the bytes fail to
 * load — a purged object, a dead edge cache, no network — the initials are
 * drawn instead, so a broken image never ships. The failed URI is remembered
 * rather than a boolean, so a fresh picture after a failure is tried again.
 */
export function AvatarCircle({ label, size = 40, background = brand.coral, emoji, imageUri }: {
  label?: string
  size?: number
  background?: string
  emoji?: string
  /** Absolute URL from `GET /me` or `RoomMember.avatarUrl`; null or undefined = initials. */
  imageUri?: string | null
}) {
  const [failedUri, setFailedUri] = useState<string | null>(null)
  const uri = imageUri && imageUri !== failedUri ? imageUri : null
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: emoji ? neutral[100] : background }]}>
      {uri ? (
        <Image
          testID="avatar-image"
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          onError={() => setFailedUri(uri)}
        />
      ) : (
        <Text style={emoji ? { fontSize: size * 0.45 } : [styles.avatarLabel, { fontSize: size * 0.38 }]}>
          {emoji ?? label}
        </Text>
      )}
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

/** Height reserved by the floating glass tab dock — tab screens pad scroll
 *  content by this so the dock never covers the last row. */
export function useTabDockInset(): number {
  const insets = useSafeAreaInsets()
  return 64 + insets.bottom + spacing[6]
}

const styles = StyleSheet.create({
  atmosphereRoot: {
    flex: 1,
    backgroundColor: neutral[50],
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
  },
  primaryBtnShadow: {
    borderRadius: radius.button,
    shadowColor: brand.coral,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 5,
  },
  primaryBtn: {
    height: 56,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: glassFx.btnBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
  },
  primaryBtnLabel: {
    ...type.body,
    color: neutral[0],
    fontWeight: '700',
  },
  secondaryBtn: {
    height: 52,
    borderRadius: radius.button,
    borderWidth: 1.5,
    borderColor: brand.coral,
    backgroundColor: glassFx.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
  },
  secondaryBtnLabel: {
    ...type.body,
    color: brand.coral,
    fontWeight: '700',
  },
  dangerBtn: {
    height: 52,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: brand.redSoft,
    backgroundColor: brand.redSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
  },
  dangerBtnLabel: {
    ...type.body,
    color: brand.red,
    fontWeight: '700',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnActive: {
    backgroundColor: brand.coralSoft,
    borderWidth: 1,
    borderColor: brand.coral,
  },
  ghostBtn: {
    height: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnLabel: {
    ...type.label,
    color: neutral[500],
  },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  inactive: { opacity: 0.45 },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  tagLabel: {
    ...type.caption,
    fontWeight: '600',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 32,
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipIcon: { ...type.bodySmall },
  chipLabel: {
    ...type.label,
  },
  chipLabelSelected: { fontWeight: '700' },
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
    ...type.body,
    fontWeight: '700',
    color: neutral[900],
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
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
    shadowColor: shadows.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  toastLabel: {
    ...type.label,
    color: neutral[0],
  },
})
