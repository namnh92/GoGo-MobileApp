import { useNavigation, usePreventRemove } from '@react-navigation/native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyboardAvoidingView, Platform, View } from 'react-native'
import { useRoom } from '@/shared/api'
import { useWaitingForNetwork } from '@/shared/api/queries/use-online-status'
import { AppHeader } from '@/shared/ui/app-header.view'
import { EmptyState, ErrorState, OfflineState } from '@/shared/ui/async-state.view'
import { Atmosphere } from '@/shared/ui/primitives'
import { ResultSheet } from '@/shared/ui/result-sheet.view'
import { Skeleton } from '@/shared/ui/skeleton.view'
import { useRoomConditionConfirmation } from './room-condition-confirmation.view'
import { RoomEditor } from './room-editor.view'
import { styles } from './room-edit.style'

export default function RoomEditScreen() {
  const { t } = useTranslation()
  const { roomId } = useLocalSearchParams<{ roomId: string }>()
  const router = useRouter()
  const navigation = useNavigation()
  const room = useRoom(roomId)
  const offline = useWaitingForNetwork(room)
  const confirmation = useRoomConditionConfirmation()
  const [dirty, setDirty] = useState(false)
  const [pending, setPending] = useState(false)
  const [discard, setDiscard] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const discardConfirmed = useRef(false)
  const next = useRef<(() => void) | null>(null)
  useEffect(() => {
    if (leaving && next.current) { const leave = next.current; next.current = null; leave() }
  }, [leaving])
  usePreventRemove(!leaving && (dirty || pending), ({ data }) => {
    if (pending) return
    if (confirmation.visible) { confirmation.dismiss(); return }
    next.current = () => navigation.dispatch(data.action)
    discardConfirmed.current = false
    setDiscard(true)
  })
  function back() {
    if (pending) return
    if (confirmation.visible) { confirmation.dismiss(); return }
    if (dirty) { discardConfirmed.current = false; next.current = () => router.back(); setDiscard(true) }
    else router.back()
  }
  return <Atmosphere>
    <KeyboardAvoidingView testID="room-edit-screen" style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} onAccessibilityEscape={back}>
      {room.data && offline ? <OfflineState /> : null}
      <AppHeader title={t('roomEdit.title')} onBack={back} backDisabled={pending} />
      {!room.data ? room.isPending ? offline ? <OfflineState /> : <View testID="room-edit-loading" style={styles.loading}>
        <Skeleton width="60%" height={24} />{[0, 1, 2, 3].map(index => <Skeleton key={index} width="100%" height={88} />)}
      </View> : <ErrorState error={room.error} onRetry={() => void room.refetch()} />
        : room.data.myRole !== 'host' ? <EmptyState title={t('roomManage.hostOnlyTitle')} body={t('roomManage.hostOnlyBody')} />
          : <RoomEditor room={room.data} onPendingChange={setPending} onDirtyChange={setDirty} confirmConditions={confirmation.confirm}
            onSaved={() => {
              // Commit the removal-guard change before dispatching navigation.
              next.current = () => { if (router.canGoBack()) router.back(); else router.replace(`/room/${roomId}/manage`) }
              setLeaving(true)
            }}
            reloadRoom={async () => {
              const fresh = await room.refetch({ cancelRefetch: false })
              if (fresh.isError || !fresh.data) throw fresh.error
              return fresh.data
            }} />}
    </KeyboardAvoidingView>
    {confirmation.sheet}
    <ResultSheet visible={discard} variant="warning" testID="room-edit-discard" title={t('roomEdit.discardTitle')} body={t('roomEdit.discardBody')}
      onClose={() => { setDiscard(false); next.current = null }}
      secondaryAction={{ label: t('roomEdit.keepEditing'), onPress: () => { setDiscard(false); next.current = null } }}
      primaryAction={{ label: t('roomEdit.discard'), onPress: () => { discardConfirmed.current = true; setDiscard(false) } }}
      onClosed={() => { if (discardConfirmed.current && next.current) { discardConfirmed.current = false; setLeaving(true) } }} />
  </Atmosphere>
}
