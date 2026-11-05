import { StyleSheet } from 'react-native-unistyles'
import { spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  header: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing[6],
  },
  /** 44 x 44 minimum touch target around the text link. */
  skip: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[7],
    gap: spacing[4],
  },
  title: {
    textAlign: 'center',
  },
  slideBody: {
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: spacing[6],
    gap: spacing[2],
  },
}))
