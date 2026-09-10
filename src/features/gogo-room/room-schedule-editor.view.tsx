import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useRef, useState } from 'react'
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

/** Mirrors `assertConstraintsEditable` on the server; the API is the guard. */
const EDITABLE: readonly RoomSummary['status'][] = ['draft', 'collecting', 'matching', 'ready']

function defaultsFor(room: RoomSummary) {
  return {
    start: isoToLocalSchedule(room.constraints?.startAt ?? room.scheduledDate),
    end: isoToLocalSchedule(room.constraints?.endAt),
  }
}

export function RoomScheduleEditor({ room }: { room: RoomSummary }) {
  const { t } = useTranslation()
  const [notice, setNotice] = useState<string | null>(null)
  const update = useUpdateRoomConstraints(room.id)
  const values = useMemo(() => defaultsFor(room), [room])
  const form = useForm({
    resolver: zodResolver(scheduleSchema),
    defaultValues: values,
    // Untouched fields follow the room (a budget save on this screen bumps
    // the version and refreshes the summary); typed ones are kept.
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const { isDirty } = form.formState
  // The room as it was when the host started typing. Sending that version,
  // not the latest one, is what turns a concurrent edit into a 409 instead
  // of silently overwriting it with values typed against stale facts.
  const editing = useRef<RoomSummary | null>(null)

  const canEdit = room.myRole === 'host' && EDITABLE.includes(room.status)

  async function submit(formValues: z.infer<typeof scheduleSchema>) {
    const base = editing.current ?? room
    if (!base.constraints || !canEdit) return
    setNotice(null)
    // The contract replaces the whole constraint (no partial PATCH), so an
    // emptied end field clears the end; a prefilled one sent back keeps it.
    const constraints = { ...base.constraints }
    delete constraints.endAt
    try {
      const updated = await update.mutateAsync({
        ...constraints,
        startAt: localScheduleToIso(formValues.start)!,
        ...(formValues.end.trim() ? { endAt: localScheduleToIso(formValues.end)! } : {}),
        expectedConstraintVersion: base.constraintVersion,
      })
      editing.current = null
      form.reset(defaultsFor(updated))
      setNotice(t('roomManage.savedStale'))
    } catch (error) {
      const conflict = isApiError(error) && error.status === 409
      setNotice(t(conflict ? 'roomManage.conflict' : 'roomManage.saveFailed'))
      // Drop the typed values: the hook refetches the room, and the form
      // then follows the version that actually won.
      if (conflict) {
        editing.current = null
        form.reset(defaultsFor(room))
      }
    }
  }

  return (
    <GlassCard style={styles.card}>
      <Text style={styles.sectionTitle}>{t('roomSchedule.title')}</Text>
      <Text style={styles.sectionBody}>{t('roomSchedule.format')}</Text>
      {(['start', 'end'] as const).map(name => (
        <Controller
          key={name}
          control={form.control}
          name={name}
          render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
            <>
              <Text style={styles.rowTitle}>{t(`roomSchedule.${name}`)}</Text>
              <TextInput
                accessibilityLabel={t(`roomSchedule.${name}`)}
                style={styles.scheduleInput}
                value={value}
                onChangeText={text => {
                  editing.current ??= room
                  onChange(text)
                }}
                onBlur={onBlur}
                editable={canEdit && !update.isPending}
                maxLength={16}
                autoCorrect={false}
                placeholder={t('roomSchedule.placeholder')}
              />
              {error ? (
                <Text accessibilityLiveRegion="polite" style={styles.warning}>
                  {t('roomSchedule.invalid')}
                </Text>
              ) : null}
            </>
          )}
        />
      ))}
      <Text style={styles.warning}>{t(canEdit ? 'roomManage.staleWarning' : 'roomSchedule.locked')}</Text>
      <PrimaryBtn
        label={t('account.save')}
        loading={update.isPending}
        disabled={!canEdit || !isDirty}
        onPress={() => void form.handleSubmit(submit)()}
      />
      {notice ? (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
    </GlassCard>
  )
}
