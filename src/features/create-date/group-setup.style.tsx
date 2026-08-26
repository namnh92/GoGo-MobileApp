import { StyleSheet } from 'react-native'
import { colors, radius, spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.neutral[900],
    lineHeight: 34,
    marginTop: spacing[2],
  },
  stepper: {
    borderRadius: radius.hero,
    padding: spacing[5],
    marginTop: spacing[7],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnLabel: { fontSize: 24, fontWeight: '700' },
  count: { fontSize: 24, fontWeight: '800', color: colors.neutral[900] },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[900],
    marginTop: spacing[6],
    marginBottom: spacing[3],
  },
  modeBtn: {
    height: 56,
    borderRadius: radius.compact,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[5],
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.neutral[0],
  },
  modeLabel: { fontSize: 15, fontWeight: '600' },
})
