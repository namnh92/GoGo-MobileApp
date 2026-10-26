import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'

import { Icon } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'
import { hitSlop } from '@/shared/ui/tokens'

import type { ProposalRow } from './proposal-rows'
import { styles } from './info-rows.style'

/**
 * Design system `InfoRows`: icon, label, value; an assumed value carries its
 * hint ("End time assumed") in words, and an editable one a "Change" link.
 */
export function InfoRows({ rows, onEdit, disabled = false }: { rows: ProposalRow[]; onEdit?: (row: ProposalRow) => void; disabled?: boolean }) {
  const { t } = useTranslation()
  return (
    <View style={styles.rows}>
      {rows.map(row => (
        <View key={row.key} style={styles.row}>
          <Icon name={row.icon} size={18} color="text.secondary" />
          <View style={styles.text} accessible accessibilityLabel={[row.label, row.value, row.hint].filter(Boolean).join(', ')}>
            <Text variant="caption" color="text.secondary">{row.label}</Text>
            <Text variant="body">{row.value}</Text>
            {row.hint ? (
              <View style={styles.hint}>
                <Icon name="info" size={12} color="status.warningText" />
                <Text variant="caption" color="status.warningText">{row.hint}</Text>
              </View>
            ) : null}
          </View>
          {row.edit && onEdit ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('assistant.proposal.changeLabel', { field: row.label })}
              accessibilityState={{ disabled }}
              disabled={disabled}
              hitSlop={hitSlop}
              onPress={() => onEdit(row)}
              style={({ pressed }) => [styles.changeBtn, pressed && styles.changeBtnPressed]}
            >
              <Text variant="label" color={disabled ? 'text.secondary' : 'accent.primary'}>{t('assistant.proposal.change')}</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  )
}
