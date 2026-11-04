import { StyleSheet } from 'react-native-unistyles'

import { touchTarget, type } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  title: { marginTop: theme.spacing[2] },
  body: { marginTop: theme.spacing[2], marginBottom: theme.spacing[5] },

  /** #277 — which stop (or the whole outing) the stars below belong to. */
  subjects: { marginBottom: theme.spacing[5] },
  subjectLabel: { marginBottom: theme.spacing[2] },
  subjectRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] },

  /** One card per question: heading, hairline, then the control. */
  section: { padding: theme.spacing[5], marginBottom: theme.spacing[4] },
  sectionHead: {
    paddingBottom: theme.spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: theme.border.hairline,
  },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: theme.spacing[1], marginTop: theme.spacing[4] },
  /** Each star is its own control, so each one has to clear 44pt. */
  starTap: {
    minWidth: touchTarget.min,
    minHeight: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingPill: {
    alignSelf: 'center',
    marginTop: theme.spacing[3],
    paddingHorizontal: theme.spacing[5],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.radius.pill,
    backgroundColor: theme.accent.soft,
  },
  ratingPillIdle: { backgroundColor: theme.surface.subtle },

  input: {
    minHeight: 120,
    marginTop: theme.spacing[3],
    padding: theme.spacing[4],
    borderRadius: theme.radius.compact,
    borderWidth: 1,
    borderColor: theme.border.hairline,
    backgroundColor: theme.surface.canvas,
    ...type.body,
    color: theme.text.primary,
    textAlignVertical: 'top',
  },
  counterRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: theme.spacing[2] },

  moderationNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing[3],
    padding: theme.spacing[4],
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.border.hairline,
    backgroundColor: theme.surface.subtle,
  },
  moderationText: { flex: 1 },
  error: { marginTop: theme.spacing[3] },

  bottomBar: {
    paddingHorizontal: theme.spacing[5],
    paddingTop: theme.spacing[3],
    borderTopWidth: 1,
    borderTopColor: theme.border.hairline,
    backgroundColor: theme.surface.canvas,
  },
  hint: { textAlign: 'center', marginBottom: theme.spacing[2] },

  // --- success -------------------------------------------------------------
  successRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing[5],
    gap: theme.spacing[3],
  },
  successHalo: {
    width: 96,
    height: 96,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.status.successSoft,
    marginBottom: theme.spacing[2],
  },
  successHaloPending: { backgroundColor: theme.status.warningSoft },
  successDisc: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.status.success,
  },
  successDiscPending: { backgroundColor: theme.status.warning },
  successTitle: { textAlign: 'center' },
  successBody: { textAlign: 'center' },
  successCard: { alignSelf: 'stretch', padding: theme.spacing[4], gap: theme.spacing[3], marginTop: theme.spacing[3] },
  successBadge: { alignSelf: 'flex-start' },
  successSubject: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing[3],
    padding: theme.spacing[3],
    borderRadius: theme.radius.compact,
    backgroundColor: theme.surface.subtle,
  },
  successSubjectName: { flex: 1 },
  successStars: { flexDirection: 'row', gap: 2 },
  successActions: { alignSelf: 'stretch', marginTop: theme.spacing[3] },
}))
