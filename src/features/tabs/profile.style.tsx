import { StyleSheet } from 'react-native'

import { colors, radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  headerRow: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  name: { ...type.title1, color: neutral[900] },
  email: { ...type.bodySmall, color: neutral[500], marginTop: 2 },

  card: { marginHorizontal: spacing[5], padding: spacing[4], marginBottom: spacing[4] },
  caption: {
    ...type.caption,
    fontWeight: '700',
    color: neutral[500],
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing[3],
  },

  /** Saved / Plans / Reviews — the three places a profile actually leads. */
  shortcutRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginHorizontal: spacing[5],
    marginBottom: spacing[4],
  },
  shortcut: {
    flex: 1,
    borderRadius: radius.card,
    padding: spacing[4],
    alignItems: 'center',
    gap: 2,
    minHeight: touchTarget.min + 32,
    justifyContent: 'center',
  },
  shortcutValue: { ...type.title1, color: neutral[900] },
  shortcutValueMuted: { ...type.title1, color: neutral[500] },
  shortcutLabel: { ...type.caption, color: neutral[500], textAlign: 'center' },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    minHeight: touchTarget.min,
    borderBottomWidth: 1,
    borderBottomColor: neutral[100],
  },
  settingLabel: { ...type.body, color: neutral[900] },
  settingPending: { ...type.caption, color: neutral[300] },

  segmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  segmentBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.compact,
    backgroundColor: neutral[50],
  },
  segmentBtnActive: { backgroundColor: brand.coral },
  segmentLabel: { ...type.caption, fontWeight: '600', color: neutral[500] },
  segmentLabelActive: { color: neutral[0] },

  logout: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTarget.min,
    paddingVertical: spacing[3],
    marginBottom: spacing[6],
  },
  logoutLabel: { ...type.body, fontWeight: '700', color: brand.coral },
  logoutError: { ...type.bodySmall, color: brand.coral, textAlign: 'center', paddingHorizontal: spacing[4] },
})
