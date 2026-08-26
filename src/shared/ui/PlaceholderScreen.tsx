import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors, radius, spacing } from '@/shared/ui/tokens'

interface PlaceholderScreenProps {
  titleKey: string
}

export function PlaceholderScreen({ titleKey }: PlaceholderScreenProps) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing[6], paddingBottom: insets.bottom }]}>
      <View style={styles.card}>
        <Text style={styles.title}>{t(titleKey)}</Text>
        <Text style={styles.body}>{t('common.placeholderBody')}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.neutral[50],
    paddingHorizontal: spacing[5],
  },
  card: {
    backgroundColor: colors.neutral[25],
    borderColor: colors.neutral[100],
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing[2],
    padding: spacing[5],
  },
  title: {
    color: colors.neutral[900],
    fontSize: 22,
    fontWeight: '700',
  },
  body: {
    color: colors.neutral[500],
    fontSize: 15,
    lineHeight: 22,
  },
})
