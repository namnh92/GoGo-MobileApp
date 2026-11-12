import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView } from 'react-native'
import { useRoom, useRoomStore } from '@/shared/store/roomStore'
import { GlassBar, useBottomBarInset } from '@/shared/ui/glass-bar.view'
import { PrimaryBtn } from '@/shared/ui/primitives'
import { spacing } from '@/shared/ui/tokens'
import { isPastSlot } from './calendar'
import { freshDay, scheduleToIso } from './schedule-day'
import { CreateTimeFields } from './create-time-fields.view'
import { WizardScreen } from './wizard-step.view'
import { styles } from './create-time.style'

export default function CreateTimeScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { roomType, startTime, endTime, setStartTime, setEndTime } = useRoom()
  const durationPreset = useRoomStore(state => state.durationPreset)
  const setDurationPreset = useRoomStore(state => state.setDurationPreset)
  const scheduleDay = useRoomStore(state => state.scheduleDay)
  const patchDraft = useRoomStore(state => state.patchDraft)
  const now = new Date()
  const day = freshDay(scheduleDay, now)
  const canContinue = startTime !== null && !isPastSlot(startTime, day, now)
  const [footerHeight, setFooterHeight] = useState(0)
  const footerInset = useBottomBarInset(footerHeight)
  function next() {
    patchDraft(scheduleToIso(startTime, endTime, day))
    router.push('/create/budget')
  }
  return <WizardScreen step="time">
    <ScrollView testID="create-time-scroll" style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: footerInset + spacing[4] }]}>
      <CreateTimeFields roomType={roomType} startTime={startTime} endTime={endTime} setStartTime={setStartTime} setEndTime={setEndTime}
        durationPreset={durationPreset} setDurationPreset={setDurationPreset} scheduleDay={day} onDayChange={scheduleDay => patchDraft({ scheduleDay })} />
    </ScrollView>
    <GlassBar placement="floating" testID="create-footer" onHeightChange={setFooterHeight}>
      <PrimaryBtn variant="stitch" label={t('common.continue')} onPress={next} disabled={!canContinue} icon="arrowRight" />
    </GlassBar>
  </WizardScreen>
}
