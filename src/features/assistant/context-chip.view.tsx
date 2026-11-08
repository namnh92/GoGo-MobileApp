import { useTranslation } from 'react-i18next'
import { Chip } from '@/shared/ui/chip.view'

/** Screen context with an independent remove action. */
export function ContextChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  const { t } = useTranslation()
  return <Chip testID="assistant-context-chip" label={`${t('assistant.context.about')} ${label}`} icon="mapPin"
    onRemove={onRemove} removeAccessibilityLabel={t('assistant.context.remove', { name: label })} />
}
