import { Image, type ImageProps } from 'expo-image'
import { useState, type ReactNode } from 'react'
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native'
import { useTranslation } from 'react-i18next'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { useLocaleContent } from '@/shared/i18n'
import { Icon, IconChevronLeft, type IconName } from '@/shared/ui/icons'
import { haptic } from '@/shared/ui/feedback'
import { ScaledText, Text, type TextColor } from '@/shared/ui/text'
import { hitSlop, touchTarget } from '@/shared/ui/tokens'
import { AmbientGlow } from './ambient-glow.view'
import { MaterialIcon } from './material-icon'
import { FrostedMaterial } from './frosted-material.view'

export { DangerBtn, GhostBtn, IconBtn, PrimaryBtn, SecondaryBtn, type ButtonProps } from '@/shared/ui/button.view'
export { Card } from '@/shared/ui/card.view'
export { useBottomBarInset } from '@/shared/ui/bottom-bar-inset'
export { Toast } from '@/shared/ui/toast.view'

/**
 * Card look for the call sites that still spread it into their own style
 * arrays (7 files plus `BackHeader`, one of them a Reanimated view). Solid, no
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

export function Chip({ label, variant = 'default', icon, emoji, onPress, accessibilityLabel, style, appearance = 'default' }: {
  appearance?: 'default' | 'discovery'
  label: string
  variant?: ChipVariant
  /** A glyph from `icons.tsx`, drawn in the label's colour before it (#382). */
  icon?: IconName
  /**
   * A taxonomy illustration (a mood, a category) that has no icon yet. UI copy
   * never carries emoji (#382); this is the residue for data-driven pictures.
   */
  emoji?: string
  onPress?: () => void
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}) {
  const selected = variant === 'selected'
  const disabled = variant === 'disabled'

  const body = (pressed: boolean) => (
    <View style={[styles.chip, styles[`chip_${variant}`], pressed && styles[`chip_${variant}Pressed`], appearance === 'discovery' && styles.discoveryChip, appearance === 'discovery' && selected && styles.discoveryChipSelected, style]}>
      {icon ? <Icon name={icon} size={14} color={CHIP_LABEL[variant]} /> : null}
      {!icon && emoji ? <Text variant="bodySmall">{emoji}</Text> : null}
      {/* Shrinks with a chip its row constrains, so the label ellipsises (#332). */}
      <Text variant={appearance === 'discovery' ? 'introSmall' : 'label'} color={appearance === 'discovery' ? selected ? 'redesign.primaryText' : 'redesign.secondary' : CHIP_LABEL[variant]} numberOfLines={appearance === 'discovery' ? undefined : 1} style={styles.chipLabel}>
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

export function ProgressDots({ total, current, variant = 'default' }: { total: number; current: number; variant?: 'default' | 'debate' | 'swipe' | 'plan' }) {
  return (
    <View style={[styles.dotsRow, variant !== 'default' && styles.redesignDotsRow, variant === 'debate' && styles.debateDotsRow]}>
      {Array.from({ length: total }).map((_, i) => (
        <View testID={`progress-dot-${i}`} key={i} style={[styles.dot, variant !== 'default' && styles.redesignDot, variant === 'swipe' && styles.swipeDot, variant === 'plan' && styles.planDot, i === current && styles.dotActive, i === current && variant !== 'default' && styles.redesignDotActive]} />
      ))}
    </View>
  )
}

export function BackHeader({ title, subtitle, onBack, right, redesign = false }: { title?: string; subtitle?: string; onBack: () => void; right?: ReactNode; redesign?: boolean }) {
  const { t } = useTranslation()
  const grouped = redesign && title && !subtitle
  const back = <Pressable
    onPress={onBack}
    accessibilityRole="button"
    accessibilityLabel={t('common.back')}
    hitSlop={hitSlop}
    style={({ pressed }) => [styles.backBtn, !redesign && glassStyles.card, redesign && styles.redesignBack, grouped && styles.redesignGroupedBack, pressed && styles.backBtnPressed]}
  >
    {redesign ? <MaterialIcon name="arrowBack" size={24} /> : <IconChevronLeft />}
  </Pressable>
  return (
    <View style={[styles.backHeader, redesign && styles.redesignHeader]}>
      {redesign && <FrostedMaterial kind="header" />}
      {grouped ? <View style={styles.redesignHeaderLeft}>
        {back}
        <Text variant="introHeading" color="redesign.ink" style={styles.redesignHeaderTitle}>{title}</Text>
      </View> : <>
        {back}
        {title && subtitle ? (
          <View style={styles.backTitleBlock}>
            <Text variant="title2" numberOfLines={1}>{title}</Text>
            <Text variant="caption" color="text.secondary" numberOfLines={1}>{subtitle}</Text>
          </View>
        ) : title ? <Text variant="title2" color="text.primary" style={styles.backTitle}>{title}</Text> : null}
      </>}
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
export function AvatarCircle({ label, size = 40, background, emoji, imageUri, icon }: {
  icon?: 'user'
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
        { backgroundColor: icon ? theme.redesign.primary : emoji ? theme.surface.subtle : background ?? theme.accent.primary },
      ]}
    >
      {icon ? <MaterialIcon name={icon} size={18} color="redesign.white" /> : uri ? (
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
        <ScaledText box={size} kind="emoji">{emoji}</ScaledText>
      ) : (
        // Sized from the prop — the one allowed exception to the type scale.
        <ScaledText box={size} kind="initials">{label}</ScaledText>
      )}
    </View>
  )
}

type RemoteImageProps = (
  | { uri: string; source?: never }
  | { source: NonNullable<ImageProps['source']>; uri?: never }
) & { style?: StyleProp<ViewStyle>; illustration?: boolean }

export function RemoteImage({ uri, source, style, illustration = false }: RemoteImageProps) {
  const { theme } = useUnistyles()
  return <Image source={source !== undefined ? source : { uri }} style={[{ backgroundColor: illustration ? theme.redesign.low : theme.surface.subtle }, style as object]} contentFit={illustration ? 'contain' : 'cover'} transition={illustration ? 0 : 150} />
}

const styles = StyleSheet.create(theme => ({
  redesignCanvas: { backgroundColor: theme.redesign.canvas },
  redesignHeader: { backgroundColor: theme.redesign.canvas, minHeight: 56, paddingHorizontal: 16, paddingVertical: 0, gap: 8 },
  redesignBack: { width: 44, height: 44, borderWidth: 0, backgroundColor: 'transparent' },
  redesignHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, gap: 8 },
  redesignHeaderTitle: { flexShrink: 1, minWidth: 0, textAlign: 'left' },
  redesignGroupedBack: { marginLeft: -8, flexShrink: 0 },
  redesignDotsRow: { gap: 8 },
  debateDotsRow: { gap: 4 },
  redesignDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.redesign.highest },
  swipeDot: { backgroundColor: theme.redesign.line, opacity: 0.6 },
  planDot: { backgroundColor: theme.redesign.dim },
  redesignDotActive: { width: 24, backgroundColor: theme.accent.primary, opacity: 1 },
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

  discoveryChip: { minHeight: 44, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: theme.redesign.low, borderWidth: 0 },
  discoveryChipSelected: { backgroundColor: theme.redesign.primarySoft },
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
  chipLabel: { flexShrink: 1 },
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
  // Title with a caption under it, left-aligned beside the back button.
  backTitleBlock: { flex: 1, marginHorizontal: theme.spacing[3] },
  backSpacer: { width: 36 },

  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
}))
