import { StyleSheet } from 'react-native-unistyles'

import { chipRowGap, touchTarget, type } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  card: { padding: theme.spacing[5], marginTop: theme.spacing[4], gap: theme.spacing[3] },
  filterRow: { flexDirection: 'row', gap: chipRowGap, paddingTop: theme.spacing[4] },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing[2],
    marginTop: theme.spacing[3],
    padding: theme.spacing[3],
    borderRadius: theme.radius.card,
    backgroundColor: theme.status.infoSoft,
  },
  noteText: { flex: 1 },
  subjectRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing[3] },
  subject: { flex: 1, minHeight: touchTarget.min, justifyContent: 'center', gap: 2 },
  ratingGroup: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
  /** Rating and date share a row: the author's own stars on the left, when on the right. */
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing[3] },
  stars: { flexDirection: 'row', gap: 2 },
  starsRow: { flexDirection: 'row', gap: theme.spacing[1] },
  starTap: {
    minWidth: touchTarget.min,
    minHeight: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtn: { alignSelf: 'flex-end' },
  input: {
    ...type.body,
    minHeight: 88,
    borderWidth: 1,
    borderColor: theme.border.hairline,
    borderRadius: theme.radius.card,
    padding: theme.spacing[3],
    color: theme.text.primary,
    textAlignVertical: 'top',
    backgroundColor: theme.surface.canvas,
  },
  actions: { flexDirection: 'row', gap: theme.spacing[2], alignItems: 'center' },
}))
