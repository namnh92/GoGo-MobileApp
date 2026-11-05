import { StyleSheet } from 'react-native-unistyles'

import { overlay, touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  /** Holds the card and, beside it, the save toggle positioned over it. */
  wrap: { position: 'relative' },

  // --- list (default): the Stitch card, photo over body ---------------------
  listCard: { overflow: 'hidden' },
  listPhoto: { aspectRatio: 1.6, backgroundColor: theme.surface.subtle },
  // `minWidth: 0` lets the text column shrink below its content, which is what
  // makes `numberOfLines={1}` ellipsise instead of pushing the card wider.
  listBody: { minWidth: 0, padding: theme.spacing[4], gap: theme.spacing[2] },
  listHead: { gap: 2, minWidth: 0 },
  // #332: the reason chips share one row at any width. They shrink and
  // ellipsise instead of wrapping — at 375pt two chips took two lines.
  tags: { flexDirection: 'row', gap: 6, minWidth: 0 },
  tagChip: { flexShrink: 1, minWidth: 0, backgroundColor: theme.surface.subtle },
  openRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  openDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.status.success },
  openLabel: { flexShrink: 1 },

  // --- grid ---------------------------------------------------------------
  gridCard: { overflow: 'hidden' },
  gridThumbWrap: { height: 124, backgroundColor: theme.surface.subtle },
  gridBody: { padding: theme.spacing[3], gap: 3, minWidth: 0 },

  // --- hero ---------------------------------------------------------------
  heroCard: { height: 260, borderRadius: theme.radius.hero, overflow: 'hidden', justifyContent: 'flex-end' },
  heroScrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: overlay.scrim },
  heroBody: { padding: theme.spacing[5], gap: 4 },
  heroTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: theme.spacing[2] },

  // --- save toggle --------------------------------------------------------
  /** On a photo: a solid disc so the glyph reads on any image; 44pt. */
  saveOnPhoto: {
    position: 'absolute',
    top: theme.spacing[3],
    right: theme.spacing[3],
    width: touchTarget.min,
    height: touchTarget.min,
    borderRadius: touchTarget.min / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface.card,
  },
}))
