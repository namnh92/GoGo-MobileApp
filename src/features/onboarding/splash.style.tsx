import { StyleSheet } from 'react-native'
import { colors } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.brand.coral,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  deco: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: colors.neutral[0],
    opacity: 0.1,
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: colors.neutral[0],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.neutral[0],
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
})
