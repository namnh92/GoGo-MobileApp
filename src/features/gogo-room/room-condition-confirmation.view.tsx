import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Keyboard } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ResultSheet } from '@/shared/ui/result-sheet.view'

export type ConfirmConditions = () => Promise<boolean>
export const RoomConditionConfirmation = createContext<ConfirmConditions | null>(null)

/** Keep the draft mounted while the existing native sheet displays its warning. */
export function useRoomConditionConfirmation(embedded = false) {
  const { t } = useTranslation()
  const parent = useContext(RoomConditionConfirmation)
  const [visible, setVisible] = useState(false)
  const resolve = useRef<((confirmed: boolean) => void) | null>(null)
  const confirmedChoice = useRef(false)
  useEffect(() => () => {
    resolve.current?.(false)
    resolve.current = null
  }, [])
  const finish = (confirmed: boolean) => {
    const pending = resolve.current
    resolve.current = null
    confirmedChoice.current = false
    setVisible(false)
    pending?.(confirmed)
  }
  const confirm: ConfirmConditions = () => new Promise<boolean>(done => {
    if (resolve.current) return done(false)
    Keyboard.dismiss()
    resolve.current = done
    setVisible(true)
  })
  return {
    confirm: parent ?? confirm,
    visible,
    dismiss: () => finish(false),
    sheet: parent ? null : <ResultSheet embedded={embedded} visible={visible} variant="warning"
      testID="room-conditions-confirmation" title={t('roomManage.changeConditionsTitle')}
      body={t('roomManage.staleWarning')} onClose={() => finish(false)}
      secondaryAction={{ label: t('common.cancel'), onPress: () => finish(false) }}
      primaryAction={{ label: t('roomEdit.saveSchedule'), onPress: () => {
        if (embedded) { finish(true); return }
        confirmedChoice.current = true
        setVisible(false)
      } }}
      onClosed={() => {
        if (!confirmedChoice.current) return
        finish(true)
      }} />,
  }
}
