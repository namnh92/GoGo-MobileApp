import { StyleSheet } from 'react-native-unistyles'

import { touchTarget } from '@/shared/ui/tokens'

/**
 * Design system `Composer`: the field at `radius-hero`, Send an accent disc
 * with `shadow-cta`, Stop a `text-primary` disc. The field grows to five
 * lines of `body` (5 × 21) and then scrolls inside.
 */
export const styles = StyleSheet.create(theme => ({
  bar: { paddingHorizontal: theme.spacing[3], paddingTop: theme.spacing[3], gap: theme.spacing[2] },
  context: { paddingHorizontal: theme.spacing[2] },
  images: { flexDirection: 'row', gap: theme.spacing[2], paddingHorizontal: theme.spacing[2] },
  image: { width: 56, height: 56, borderRadius: theme.radius.compact, overflow: 'hidden', backgroundColor: theme.surface.subtle },
  imageFill: { width: '100%', height: '100%' },
  imageBusy: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.text.secondary,
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface.card,
  },
  removeBtnPressed: { backgroundColor: theme.surface.subtle },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing[2] },
  round: {
    width: touchTarget.min,
    height: touchTarget.min,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundPressed: { backgroundColor: theme.surface.subtle },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: touchTarget.min,
    borderRadius: theme.radius.hero,
    borderWidth: 1,
    borderColor: theme.border.hairline,
    backgroundColor: theme.surface.card,
    paddingLeft: theme.spacing[4],
  },
  input: {
    ...theme.type.body,
    flex: 1,
    color: theme.text.primary,
    paddingTop: 11,
    paddingBottom: 11,
    maxHeight: 5 * 21 + 22,
  },
  mic: {
    width: touchTarget.min,
    height: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  send: {
    width: touchTarget.min,
    height: touchTarget.min,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent.primary,
    ...theme.shadows.cta,
  },
  sendPressed: { backgroundColor: theme.accent.pressed },
  sendDisabled: { backgroundColor: theme.surface.subtle, shadowOpacity: 0, elevation: 0 },
  stop: {
    width: touchTarget.min,
    height: touchTarget.min,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.text.primary,
  },
  stopPressed: { backgroundColor: theme.text.secondary },
  hint: { textAlign: 'center', paddingHorizontal: theme.spacing[4] },
}))
