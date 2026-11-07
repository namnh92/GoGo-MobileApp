import { View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTaxonomies } from '@/shared/api'
import { Text } from '@/shared/ui/text'
import { optionLabel, taxonomyOptions } from './contribution-options'
import type { ContributionForm } from './contribution-form'
import { styles } from './contribution-wizard.style'

/** Read-only claims for explicit cleanup review; never reclaims returned media. */
export function CleanupReview({ fields, mediaCount }: { fields: ContributionForm; mediaCount: number }) {
  const { t, i18n } = useTranslation()
  const taxonomies = useTaxonomies({ kinds: 'suitability,mood,amenity,checkin_tag' })
  const label = (kind: string, key: string) => {
    const option = taxonomyOptions(taxonomies.data, kind).find(o => o.key === key)
    return option ? optionLabel(option, i18n.language, key) : key
  }
  return <View style={styles.note}>
    {fields.priceKnown ? <Text>{t('placeWizard.price')}: {fields.min}–{fields.max} VND · {t(`placeWizard.unit.${fields.unit}`)}</Text> : null}
    {fields.purposeKeys.length ? <Text>{t('placeWizard.purposes')}: {fields.purposeKeys.map(k => label('suitability', k)).join(', ')}</Text> : null}
    {fields.vibeKeys.length ? <Text>{t('placeWizard.vibes')}: {fields.vibeKeys.map(k => label('mood', k)).join(', ')}</Text> : null}
    {Object.entries(fields.amenities).map(([key, value]) => <Text key={key}>{label('amenity', key)}: {t(value ? 'placeWizard.lifecycle.present' : 'placeWizard.lifecycle.absent')}</Text>)}
    {fields.recommendedDishes ? <Text>{fields.recommendedDishes}</Text> : null}
    {fields.visitTips ? <Text>{fields.visitTips}</Text> : null}
    {fields.serviceRating ? <Text>{t('placeWizard.service')}: {fields.serviceRating}/5 · {fields.serviceChips.map(k => label('checkin_tag', k)).join(', ')}</Text> : null}
    {fields.spaceRating ? <Text>{t('placeWizard.space')}: {fields.spaceRating}/5 · {fields.spaceChips.map(k => label('checkin_tag', k)).join(', ')}</Text> : null}
    <Text>{t('placeWizard.lifecycle.publicPhotos', { count: mediaCount })}</Text>
  </View>
}
