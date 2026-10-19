import { StyleSheet } from 'react-native-unistyles'

import { colors, fill, glassFx, overlay, radius, spacing } from '@/shared/ui/tokens'

const { neutral } = colors

export const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...fill, backgroundColor: overlay.backdrop },
  sheet: {
    backgroundColor: glassFx.sheet,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    gap: spacing[3],
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: neutral[100],
    alignSelf: 'center',
    marginBottom: spacing[1],
  },
  actions: { gap: spacing[2], marginTop: spacing[2] },
})
