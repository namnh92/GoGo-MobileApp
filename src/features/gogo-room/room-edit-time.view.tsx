import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { UseFormReturn } from 'react-hook-form'
import { CreateTimeFields } from '@/features/create-date/create-time-fields.view'
import { localDayKey, scheduleToIso } from '@/features/create-date/schedule-day'
import { isoToLocalSchedule, localScheduleToIso } from './room-schedule'
import type { RoomEditorValues } from './room-editor'

export function RoomEditTime({ form, values, roomType, disabled = false }: { disabled?: boolean; form: UseFormReturn<RoomEditorValues>; values: RoomEditorValues; roomType: 'couple' | 'group' }) {
  const { t } = useTranslation()
  const startIso = localScheduleToIso(values.start)
  const endIso = localScheduleToIso(values.end)
  const startDate = startIso ? new Date(startIso) : null
  const endDate = endIso ? new Date(endIso) : null
  const startTime = startDate ? values.start.slice(-5) : null
  const endTime = endDate ? values.end.slice(-5) : null
  const [pickedDay, setPickedDay] = useState<string | null>(null)
  const day = startDate ? localDayKey(startDate) : pickedDay
  // Each callback updates only what the user touched. In particular mounting
  // never round-trips the stored timestamps or normalizes a custom window.
  const setTime = (field: 'start' | 'end', slot: string | null) => {
    const current = form.getValues(field)
    if (!slot || current) {
      form.setValue(field, slot ? `${current.slice(0, -5)}${slot}` : '', { shouldValidate: true })
      return
    }
    const currentStart = form.getValues('start')
    const next = scheduleToIso(field === 'start' ? slot : currentStart ? currentStart.slice(-5) : null, field === 'end' ? slot : endTime, day ?? localDayKey(new Date()))
    form.setValue(field, isoToLocalSchedule((field === 'start' ? next.startAt : next.endAt) ?? undefined), { shouldValidate: true })
  }
  return <CreateTimeFields mode="edit" showDurationPresets={false} sectionTitle={t('roomSchedule.title')} disabled={disabled} key={`${day ?? ''}`} roomType={roomType} startTime={startTime} endTime={endTime}
    scheduleDay={day} selectedEndDate={endDate ?? undefined} durationPreset={null} setDurationPreset={() => {}}
    setStartTime={slot => setTime('start', slot)} setEndTime={slot => setTime('end', slot)}
    onDayChange={nextDay => {
      setPickedDay(nextDay)
      const previousStart = startDate ?? new Date()
      const target = nextDay ? new Date(`${nextDay}T00:00:00`) : new Date()
      const delta = Math.round((Date.UTC(target.getFullYear(), target.getMonth(), target.getDate()) - Date.UTC(previousStart.getFullYear(), previousStart.getMonth(), previousStart.getDate())) / 86400000)
      for (const [field, date] of [['start', startDate], ['end', endDate]] as const) {
        if (!date) continue
        const next = new Date(date); next.setDate(next.getDate() + delta)
        form.setValue(field, isoToLocalSchedule(next.toISOString()), { shouldValidate: true })
      }
    }} />
}
