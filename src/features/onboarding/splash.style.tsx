import { StyleSheet } from 'react-native'

import { colors, onDark, shadows, spacing, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: brand.coral,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  /** Two soft washes give the flat coral some depth without a gradient asset. */
  deco: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: neutral[0],
    opacity: 0.1,
  },
  logoBox: {
    width: 96,
    height: 96,
    borderRadius: 32,
    backgroundColor: neutral[0],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: shadows.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 10,
  },
  wordmark: {
    ...type.display,
    fontSize: 40,
    lineHeight: 48,
    color: neutral[0],
    letterSpacing: -0.5,
    marginTop: spacing[6],
  },
  tagline: {
    ...type.body,
    color: onDark.medium,
    marginTop: spacing[1],
  },
})
