import { BlockingLoadingOverlay } from '@/shared/ui/blocking-loading-overlay.view'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { TextInput } from '@/shared/ui/text-input'
import { z } from 'zod'

import { isApiError, useRenameRoom, type RoomSummary } from '@/shared/api'
import { Card, PrimaryBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { SheetActions } from '@/shared/ui/sheet-actions.view'

import { styles } from './room-manage.style'

/** The bounds the server applies (BE-BFF-022), checked before sending. */
const titleSchema = z.object({ title: z.string().trim().max(80) })

/** Mirrors the server's planning window; the API is the guard. */
const EDITABLE: readonly RoomSummary['status'][] = ['draft', 'collecting', 'matching', 'ready']

/**
 * APP-049 (#202) — rename after creation. Emptying the field removes the name,
 * and every list falls back to "Kèo chưa đặt tên".
 */
export function RoomTitleEditor({ room, onCancel }: { room: RoomSummary; onCancel?: () => void }) {
  const { t } = useTranslation()
  const rename = useRenameRoom(room.id)
  const [notice, setNotice] = useState<string | null>(null)
  const values = useMemo(() => ({ title: room.title ?? '' }), [room.title])
  const form = useForm({
    resolver: zodResolver(titleSchema),
    defaultValues: values,
    // A refetch updates an untouched field; a name being typed is kept.
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const { isDirty } = form.formState
  const canEdit = room.myRole === 'host' && EDITABLE.includes(room.status)

  async function submit({ title }: z.infer<typeof titleSchema>) {
    if (!canEdit) return
    setNotice(null)
    try {
      const updated = await rename.mutateAsync(title.length > 0 ? title : null)
      form.reset({ title: updated.title ?? '' })
      setNotice(t(updated.title ? 'roomTitle.saved' : 'roomTitle.cleared'))
    } catch (error) {
      setNotice(
        t(isApiError(error) && error.code === 'ROOM_NOT_EDITABLE' ? 'roomTitle.locked' : 'roomManage.saveFailed'),
      )
    }
  }

  return (
    <Card padded={false} style={styles.card}>
      <BlockingLoadingOverlay visible={rename.isPending} />
      <Text variant="bodySmall" color="text.secondary">{t('roomTitle.body')}</Text>
      <Controller
        control={form.control}
        name="title"
        render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
          <>
            <View style={styles.labelRow}>
              <Text variant="title2">{t('roomTitle.title')}</Text>
              <Text variant="caption" color="text.secondary">{`${value.length}/80`}</Text>
            </View>
            <TextInput
              accessibilityLabel={t('roomTitle.title')}
              style={styles.scheduleInput}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              editable={canEdit && !rename.isPending}
              maxLength={80}
              placeholder={t('plans.untitled')}
            />
            {error ? (
              <Text variant="caption" color="status.warningText" accessibilityLiveRegion="polite">
                {t('roomTitle.tooLong')}
              </Text>
            ) : null}
          </>
        )}
      />
      {canEdit ? null : <Text variant="caption" color="status.warningText">{t('roomTitle.locked')}</Text>}
      <SheetActions>
      {onCancel ? <SecondaryBtn label={t('common.cancel')} onPress={onCancel} disabled={rename.isPending} /> : null}
      <PrimaryBtn
        label={rename.isPending ? t('account.saving') : t('account.save')}
        onPress={() => void form.handleSubmit(submit)()}
        loading={rename.isPending}
        disabled={!canEdit || !isDirty}
      />
      </SheetActions>
      {notice ? (
        <Text variant="bodySmall" color="text.secondary" accessibilityLiveRegion="polite" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
    </Card>
  )
}
