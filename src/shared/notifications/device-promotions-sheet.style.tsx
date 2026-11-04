import { StyleSheet } from 'react-native-unistyles'

import { fill, overlay, radius, spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...fill, backgroundColor: overlay.backdrop },
  sheet: {
    backgroundColor: theme.surface.card,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    gap: spacing[3],
    maxHeight: '90%',
  },
  // The body is never clipped at large text sizes.
  bodyScroll: { flexShrink: 1 },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.border.hairline,
    alignSelf: 'center',
    marginBottom: spacing[1],
  },
  actions: { gap: spacing[2], marginTop: spacing[2] },
}))
