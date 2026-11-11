import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PrimaryBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { Sheet } from '@/shared/ui/sheet.view'
import { SheetActions } from '@/shared/ui/sheet-actions.view'
import { Text } from '@/shared/ui/text'
import { TimeWheel } from '@/shared/ui/time-wheel.view'
import { styles } from './time-picker-sheet.style'

/** Staged time editor; Cancel and dismissal never write the draft. */
export function TimePickerSheet({ visible, initialTime, title, isInvalid, invalidHint, onClose, onDone, testID }: {
  visible: boolean; initialTime: string; title: string; isInvalid?: (time: string) => boolean; invalidHint?: string
  onClose: () => void; onDone: (time: string) => void; testID: string
}) {
  const { t } = useTranslation()
  const [time, setTime] = useState(initialTime)
  const [seenVisible, setSeenVisible] = useState(visible)
  if (seenVisible !== visible) {
    setSeenVisible(visible)
    if (visible) setTime(initialTime)
  }
  const invalid = isInvalid?.(time) ?? false
  return <Sheet visible={visible} onClose={onClose} scroll={false} testID={testID}
    footer={<SheetActions><SecondaryBtn label={t('common.cancel')} onPress={onClose} /><PrimaryBtn label={t('createTime.done')} disabled={invalid} onPress={() => onDone(time)} /></SheetActions>}>
    <Text variant="title1" style={styles.title}>{title}</Text>
    <TimeWheel value={time} onChange={setTime} testID={`${testID}-wheel`} />
    {invalid && invalidHint ? <Text color="status.dangerText" accessibilityLiveRegion="polite">{invalidHint}</Text> : null}
  </Sheet>
}
