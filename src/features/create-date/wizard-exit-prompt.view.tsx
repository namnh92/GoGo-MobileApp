import { View } from 'react-native'

import type { DialogProps } from '@/shared/ui/dialog.view'
import { DangerBtn, PrimaryBtn, SecondaryBtn } from '@/shared/ui/button.view'
import { Icon } from '@/shared/ui/icons'
import { SheetActions } from '@/shared/ui/sheet-actions.view'
import { Sheet } from '@/shared/ui/sheet.view'
import { Text } from '@/shared/ui/text'

import { cancelWizardRecovery, useWizardModal } from './wizard-modal'
import { styles } from './wizard-exit-prompt.style'

/** The existing confirmation's actions and promise, presented as Stitch 5.9. */
export function WizardExitPrompt({ visible, title, message, actions, onAction, onDismiss, onClosed }: DialogProps) {
  const releaseModal = useWizardModal(visible)
  function choose(key: string) {
    if (actions.find(action => action.key === key)?.style !== 'cancel') cancelWizardRecovery()
    onAction(key)
  }
  const keep = actions.find(action => action.style === 'cancel')
  const discard = actions.find(action => action.style === 'destructive')
  const save = actions.find(action => !action.style || action.style === 'default')
  return <Sheet visible={visible} onClose={onDismiss} onClosed={() => { onClosed?.(); releaseModal() }} testID="wizard-exit-prompt">
    <View style={styles.content}>
      <View style={styles.icon}><Icon name="mail" size={28} color="accent.onSoft" /></View>
      <Text variant="discoveryTitle" accessibilityRole="header" style={styles.text}>{title}</Text>
      {message ? <Text color="text.secondary" style={styles.text}>{message}</Text> : null}
    </View>
    <SheetActions>
      {keep ? <SecondaryBtn label={keep.label} onPress={() => choose(keep.key)} variant="neutral" /> : null}
      {discard ? <DangerBtn label={discard.label} onPress={() => choose(discard.key)} /> : null}
      {save ? <PrimaryBtn label={save.label} onPress={() => choose(save.key)} /> : null}
    </SheetActions>
  </Sheet>
}
