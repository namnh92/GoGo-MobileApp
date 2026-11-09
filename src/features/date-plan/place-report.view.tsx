import { BlockingLoadingOverlay } from '@/shared/ui/blocking-loading-overlay.view'
import { SheetActions } from '@/shared/ui/sheet-actions.view'
import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { z } from 'zod'

import { track } from '@/shared/analytics'
import { isApiError, useReportPlace } from '@/shared/api'
import { useSession } from '@/shared/providers/session-provider'
import { Chip, GhostBtn, PrimaryBtn } from '@/shared/ui/primitives'
import { Sheet } from '@/shared/ui/sheet.view'
import { Text } from '@/shared/ui/text'
import { TextInput } from '@/shared/ui/text-input'

import { styles } from './place-report.style'

// Extensible keys declared by reportPlace, rather than display strings in the payload.
const reasons = ['wrong_hours', 'wrong_price', 'wrong_location', 'permanently_closed', 'other'] as const
const schema = z.object({
  reasonCode: z.enum(reasons),
  note: z.string().max(500).transform(value => value.replace(/\r\n/g, '\n')).refine(value => !/[\x00-\x08\x0B-\x1F\x7F]/.test(value)),
})

export function PlaceReport({ placeId, onClose }: { placeId: string; onClose: () => void }) {
  const { t } = useTranslation()
  const [closing, setClosing] = useState(false)
  const close = () => setClosing(true)
  const { status } = useSession()
  const report = useReportPlace(placeId)
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { reasonCode: 'other', note: '' } })
  const canReport = status === 'user' || status === 'guest'

  return (
    <Sheet visible={!closing} onClose={close} onClosed={onClose} header={<Text variant="title2">{t('placeDetail.report')}</Text>} testID="place-report-sheet">
      <BlockingLoadingOverlay visible={report.isPending} />
      <View style={styles.body}>
        {!canReport ? <Text>{t('placeReport.signIn')}</Text> : report.isSuccess ? <Text accessibilityLiveRegion="polite">{t('placeReport.sent')}</Text> : (
          <>
            <Controller control={form.control} name="reasonCode" render={({ field }) => (
              <View style={styles.reasons}>{reasons.map(reason => <Chip key={reason} label={t(`placeReport.reason.${reason}`)} variant={field.value === reason ? 'selected' : 'default'} onPress={() => field.onChange(reason)} />)}</View>
            )} />
            <Controller control={form.control} name="note" render={({ field }) => (
              <TextInput style={styles.note} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} multiline maxLength={500} accessibilityLabel={t('placeReport.note')} placeholder={t('placeReport.note')} />
            )} />
            {form.formState.errors.note ? <Text color="status.dangerText">{t('placeReport.invalidNote')}</Text> : null}
            {report.isError ? <Text color="status.dangerText" accessibilityLiveRegion="polite">{t(isApiError(report.error) && report.error.status === 429 ? 'placeImport.rateLimited' : 'placeReport.failed')}</Text> : null}
          </>
        )}
        <SheetActions>
          <GhostBtn label={t('common.close')} onPress={close} />
          {canReport && !report.isSuccess ? <PrimaryBtn label={t('placeReport.send')} loading={report.isPending} onPress={form.handleSubmit(body => { if (!report.isPending) report.mutate({ reasonCode: body.reasonCode, ...(body.note.trim() ? { note: body.note.trim() } : {}) }, { onSuccess: () => track('place_report_submitted', { placeId, reason: body.reasonCode }) }) })} /> : null}
        </SheetActions>
      </View>
    </Sheet>
  )
}
