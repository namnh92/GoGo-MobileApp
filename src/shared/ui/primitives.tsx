import { Image } from 'expo-image'
import { useState, type ReactNode } from 'react'
import { Pressable, Text as RNText, View, type StyleProp, type ViewStyle } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { useLocaleContent } from '@/shared/i18n'
import { Card } from '@/shared/ui/card.view'
import { IconChevronLeft } from '@/shared/ui/icons'
import { haptic } from '@/shared/ui/feedback'
import { Text, type TextColor } from '@/shared/ui/text'
import { border, hitSlop, shadows, spacing, surface, touchTarget } from '@/shared/ui/tokens'

export { DangerBtn, GhostBtn, IconBtn, PrimaryBtn, SecondaryBtn, type ButtonProps } from '@/shared/ui/button.view'
export { Card } from '@/shared/ui/card.view'

/**
 * Static card look for the call sites that still spread it into their own
 * style arrays (8 files, one of them a Reanimated view). Solid, no accent, so
 * it needs no theme. #298 removes it with the last importer.
 *
 * @deprecated Use `Card`.
 */
export const glassStyles = {
  card: {
    backgroundColor: surface.card,
    borderWidth: 1,
    borderColor: border.hairline,
    ...shadows.card,
  },
  strong: {
    backgroundColor: surface.card,
    borderWidth: 1,
    borderColor: border.hairline,
    ...shadows.card,
  },
} as const satisfies Record<string, ViewStyle>

/**
 * @deprecated #295 made every card solid (`Card`). This alias keeps the 55
 * call sites working unchanged: it renders an *unpadded* `Card`, because each
 * of them already pads itself. `strong` and `interactive` are accepted and
 * ignored. #298 migrates the callers and deletes it.
 */
export function GlassCard({ children, style }: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  strong?: boolean
  interactive?: boolean
}) {
  return (
    <Card padded={false} style={style}>
      {children}
    </Card>
  )
}

/**
 * The screen canvas. It used to be colour blobs under a full-screen blur; #293
 * replaces that with a flat `surface.canvas`, which is also what the design
 * system asks of a background — no full-screen blur, contrast never depending
 * on the layer behind (RULE-DS).
 */
export function Atmosphere({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.canvas, style]}>{children}</View>
}

export type TagColor = 'coral' | 'violet' | 'green' | 'neutral'

const TAG_LABEL: Record<TagColor, TextColor> = {
  coral: 'accent.onSoft',
  violet: 'status.infoText',
  green: 'status.successText',
  // `text.secondary` measures 4.12 on `surface.subtle`; a tag is not disabled.
  neutral: 'text.primary',
}

/**
 * Chip states (spec §7). `selected` is the only interactive one; the rest are
 * read-only meaning. Selection is never colour alone — the label also carries
 * a check, because roughly one man in twelve cannot tell the accent fill from
 * the neutral one (RULE-DS colour-is-not-the-only-signal).
 */
export type ChipVariant = 'default' | 'selected' | 'disabled' | 'info' | 'positive' | 'warning'

const CHIP_LABEL: Record<ChipVariant, TextColor> = {
  default: 'text.primary',
  selected: 'accent.onAccent',
  disabled: 'text.secondary',
  info: 'status.infoText',
  positive: 'status.successText',
  warning: 'status.warningText',
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
  const selected = variant === 'selected'
  const disabled = variant === 'disabled'

  const body = (pressed: boolean) => (
    <View style={[styles.chip, styles[`chip_${variant}`], pressed && styles[`chip_${variant}Pressed`], style]}>
      {icon ? <Text variant="bodySmall">{icon}</Text> : null}
      <Text variant="label" color={CHIP_LABEL[variant]} numberOfLines={1}>
        {selected ? `✓ ${label}` : label}
      </Text>
    </View>
  )

  if (!onPress) return body(false)

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
    >
      {({ pressed }) => body(pressed && !disabled)}
    </Pressable>
  )
}

// Canonical tag keys live in mock data; display label is locale-mapped here.
export function TagChip({ label, color = 'neutral' }: { label: string; color?: TagColor }) {
  const { tagLabels } = useLocaleContent()
  return (
    <View style={[styles.tag, styles[`tag_${color}`]]}>
      <Text variant="caption" color={TAG_LABEL[color]}>{tagLabels[label] ?? label}</Text>
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
        style={({ pressed }) => [styles.backBtn, glassStyles.card, pressed && styles.backBtnPressed]}
      >
        <IconChevronLeft />
      </Pressable>
      {title ? <Text variant="title2" style={styles.backTitle}>{title}</Text> : null}
      {right ?? <View style={styles.backSpacer} />}
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
export function AvatarCircle({ label, size = 40, background, emoji, imageUri }: {
  label?: string
  size?: number
  /** Defaults to the theme accent. */
  background?: string
  emoji?: string
  /** Absolute URL from `GET /me` or `RoomMember.avatarUrl`; null or undefined = initials. */
  imageUri?: string | null
}) {
  const { theme } = useUnistyles()
  const [failedUri, setFailedUri] = useState<string | null>(null)
  const uri = imageUri && imageUri !== failedUri ? imageUri : null
  const circle = { width: size, height: size, borderRadius: size / 2 }
  return (
    <View
      style={[
        styles.avatar,
        circle,
        { backgroundColor: emoji ? theme.surface.subtle : background ?? theme.accent.primary },
      ]}
    >
      {uri ? (
        <Image
          testID="avatar-image"
          source={{ uri }}
          style={circle}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          onError={() => setFailedUri(uri)}
        />
      ) : emoji ? (
        <RNText style={{ fontSize: size * 0.45 }}>{emoji}</RNText>
      ) : (
        // Sized from the prop — the one allowed exception to the type scale.
        <RNText
          style={[theme.type.label, { fontSize: size * 0.38, lineHeight: size * 0.5, color: theme.accent.onAccent }]}
        >
          {label}
        </RNText>
      )}
    </View>
  )
}

export function RemoteImage({ uri, style }: { uri: string; style?: StyleProp<ViewStyle> }) {
  return <Image source={{ uri }} style={[{ backgroundColor: surface.subtle }, style as object]} contentFit="cover" transition={150} />
}

/** Fixed toast near the top of the screen — `role=status` equivalent. */
export function Toast({ message }: { message: string }) {
  const insets = useSafeAreaInsets()
  return (
    <View accessibilityLiveRegion="polite" style={[styles.toast, { top: insets.top + spacing[6] }]}>
      <RNText style={styles.toastLabel}>{message}</RNText>
    </View>
  )
}

/** Height reserved by the floating glass tab dock — tab screens pad scroll
 *  content by this so the dock never covers the last row. */
export function useTabDockInset(): number {
  const insets = useSafeAreaInsets()
  return 64 + insets.bottom + spacing[6]
}

const styles = StyleSheet.create(theme => ({
  canvas: { flex: 1, backgroundColor: theme.surface.canvas },

  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },
  tag_coral: { backgroundColor: theme.accent.soft },
  tag_violet: { backgroundColor: theme.status.infoSoft },
  tag_green: { backgroundColor: theme.status.successSoft },
  tag_neutral: { backgroundColor: theme.surface.subtle },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 32,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
  },
  chip_default: { backgroundColor: theme.surface.card, borderColor: theme.border.hairline },
  chip_defaultPressed: { backgroundColor: theme.surface.subtle },
  chip_selected: { backgroundColor: theme.accent.primary, borderColor: theme.accent.primary },
  chip_selectedPressed: { backgroundColor: theme.accent.pressed, borderColor: theme.accent.pressed },
  chip_disabled: { backgroundColor: theme.surface.subtle, borderColor: theme.surface.subtle },
  chip_disabledPressed: {},
  chip_info: { backgroundColor: theme.status.infoSoft, borderColor: theme.status.infoSoft },
  chip_infoPressed: {},
  chip_positive: { backgroundColor: theme.status.successSoft, borderColor: theme.status.successSoft },
  chip_positivePressed: {},
  chip_warning: { backgroundColor: theme.status.warningSoft, borderColor: theme.status.warningSoft },
  chip_warningPressed: {},

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

  backHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[5],
    paddingVertical: theme.spacing[3],
  },
  backBtn: {
    width: 36,
    height: 36,
    minWidth: touchTarget.min - 8,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnPressed: { backgroundColor: theme.surface.subtle },
  backTitle: {
    // Titles composed from facts (a plan's audience and date) can outgrow a
    // narrow row; wrap between the side controls instead of pushing them out.
    flexShrink: 1,
    textAlign: 'center',
    marginHorizontal: theme.spacing[2],
  },
  backSpacer: { width: 36 },

  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  toast: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: theme.text.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.radius.compact,
    zIndex: 20,
    ...theme.shadows.toast,
  },
  toastLabel: {
    ...theme.type.label,
    color: theme.surface.card,
  },
}))
