import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Text, TextInput } from 'react-native'
import { z } from 'zod'
import { isApiError, useUpdateRoomConstraints, type RoomSummary } from '@/shared/api'
import { GlassCard, PrimaryBtn } from '@/shared/ui/primitives'
import { isoToLocalSchedule, localScheduleToIso } from './room-schedule'
import { styles } from './room-manage.style'

const scheduleSchema = z.object({ start: z.string(), end: z.string() }).superRefine((value, ctx) => {
  const start = localScheduleToIso(value.start)
  const end = value.end.trim() ? localScheduleToIso(value.end) : null
  if (!start) ctx.addIssue({ code: 'custom', path: ['start'], message: 'invalid' })
  if ((value.end.trim() && !end) || (start && end && end <= start)) {
    ctx.addIssue({ code: 'custom', path: ['end'], message: 'invalid' })
  }
})

export function RoomScheduleEditor({ room }: { room: RoomSummary }) {
  const { t } = useTranslation()
  // Keep the version being edited. A background refresh must not turn a stale
  // form into an apparently current edit and overwrite another host action.
  const [baseline, setBaseline] = useState(room)
  const [notice, setNotice] = useState<string | null>(null)
  const update = useUpdateRoomConstraints(room.id)
  const form = useForm({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      start: isoToLocalSchedule(room.constraints?.startAt ?? room.scheduledDate),
      end: isoToLocalSchedule(room.constraints?.endAt),
    },
  })
  const canEdit = room.myRole === 'host' && ['draft', 'collecting', 'matching', 'ready'].includes(room.status)
  return <GlassCard style={styles.card}>
    <Text style={styles.sectionTitle}>{t('roomSchedule.title')}</Text>
    <Text style={styles.sectionBody}>{t('roomSchedule.format')}</Text>
    {(['start', 'end'] as const).map(name => <Controller
      key={name} control={form.control} name={name}
      render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => <>
        <Text style={styles.rowTitle}>{t(`roomSchedule.${name}`)}</Text>
        <TextInput
          accessibilityLabel={t(`roomSchedule.${name}`)}
          style={styles.scheduleInput} value={value} onChangeText={onChange} onBlur={onBlur}
          editable={canEdit && !update.isPending} maxLength={16} autoCorrect={false}
          placeholder={t('roomSchedule.placeholder')}
        />
        {error ? <Text accessibilityLiveRegion="polite" style={styles.warning}>{t('roomSchedule.invalid')}</Text> : null}
      </>}
    />)}
    <Text style={styles.warning}>{t(canEdit ? 'roomManage.staleWarning' : 'roomSchedule.locked')}</Text>
    <PrimaryBtn label={t('account.save')} loading={update.isPending}
      disabled={!canEdit || !form.formState.isDirty}
      onPress={form.handleSubmit(async values => {
        if (!baseline.constraints || !canEdit) return
        if (baseline.constraints.endAt && !values.end.trim()) {
          form.setError('end', { message: 'invalid' })
          return
        }
        setNotice(null)
        try {
          const updated = await update.mutateAsync({
            ...baseline.constraints,
            startAt: localScheduleToIso(values.start)!,
            // Clearing an optional end is not in the current contract. An empty
            // field leaves an existing end intact instead of silently deleting it.
            ...(values.end.trim() ? { endAt: localScheduleToIso(values.end)! } : {}),
            expectedConstraintVersion: baseline.constraintVersion,
          })
          setBaseline(updated)
          form.reset({ start: isoToLocalSchedule(updated.constraints?.startAt), end: isoToLocalSchedule(updated.constraints?.endAt) })
          setNotice(t('roomManage.savedStale'))
        } catch (error) {
          setNotice(t(isApiError(error) && error.status === 409 ? 'roomManage.conflict' : 'roomManage.saveFailed'))
        }
      })}
    />
    {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
  </GlassCard>
}
