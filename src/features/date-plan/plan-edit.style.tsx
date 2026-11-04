import { StyleSheet } from 'react-native-unistyles'

import { touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  /** The one line that says what editing does, on a soft card at the top. */
  intro: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing[3],
    padding: theme.spacing[4],
    marginBottom: theme.spacing[4],
    borderRadius: theme.radius.card,
    backgroundColor: theme.surface.subtle,
  },
  introText: { flex: 1 },
  row: { marginBottom: theme.spacing[2], overflow: 'hidden' },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3], padding: theme.spacing[3] },
  thumb: { width: 64, height: 64, borderRadius: theme.radius.thumbnail },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing[2], marginTop: 2 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    backgroundColor: theme.surface.canvas,
  },
  actionSpacer: { flex: 1 },
  iconBtn: {
    minHeight: touchTarget.min,
    minWidth: touchTarget.min,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[1],
    paddingHorizontal: theme.spacing[3],
    borderRadius: theme.radius.pill,
    backgroundColor: theme.surface.card,
    borderWidth: 1,
    borderColor: theme.border.hairline,
  },
  iconBtnDisabled: { opacity: 0.35 },
  error: { marginTop: theme.spacing[3] },
  saveBar: { gap: theme.spacing[2] },
  saveBtn: { alignSelf: 'stretch' },
}))
