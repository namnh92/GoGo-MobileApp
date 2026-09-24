import { StyleSheet } from 'react-native-unistyles'

import { glassFx, overlay, touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  // --- list (default) ------------------------------------------------------
  listCard: { flexDirection: 'row', gap: theme.spacing[3] },
  listThumb: { width: 96, height: 96, borderRadius: theme.radius.thumbnail, overflow: 'hidden' },
  // `minWidth: 0` lets the text column shrink below its content, which is what
  // makes `numberOfLines={1}` ellipsise instead of pushing the card wider.
  listBody: { flex: 1, minWidth: 0, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing[2] },
  name: { flex: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: theme.spacing[2] },

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
  /**
   * 44×44 target with the glyph pulled into the card's corner: the negative
   * margins eat the card padding, not the touch area.
   */
  save: {
    width: touchTarget.min,
    height: touchTarget.min,
    marginTop: -theme.spacing[2],
    marginRight: -theme.spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** On a photo: a solid disc so the glyph reads on any image; slop makes 44. */
  saveOnPhoto: {
    position: 'absolute',
    top: theme.spacing[2],
    right: theme.spacing[2],
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: glassFx.solid,
  },
}))
