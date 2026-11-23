import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import { useGetClientsQuery } from '@/features/agency/api.js'
import { useFormat } from '@/lib/preferences.js'
import styles from './JobAiDraft.module.css'

const lines = (text) =>
  String(text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
const skillNames = (skills) => (skills ?? []).map((skill) => (typeof skill === 'string' ? skill : skill.name)).filter(Boolean)

/** One field's value as the comparison shows it (`period` is the rate's, beside the amount). */
function useShow(agency) {
  const { t } = useTranslation()
  const format = useFormat()
  const { data: clients } = useGetClientsQuery(undefined, { skip: !agency })
  return (field, value, period) => {
    switch (field) {
      case 'brief':
        return <span className={styles.compareClamp}>{value.trim()}</span>
      case 'responsibilities':
        return (
          <ul className={styles.previewList}>
            {lines(value).map((line, index) => (
              <li key={`${index}-${line}`}>{line}</li>
            ))}
          </ul>
        )
      case 'requiredSkills':
      case 'preferredSkills':
        return skillNames(value).join(' · ')
      case 'level':
        return t(`enums:jobLevel.${value}`)
      case 'requiredLanguages':
        return value.map(({ code }) => format.languageName(code)).join(' · ')
      case 'clientId':
        return clients?.items.find((client) => client.id === value)?.name ?? '—'
      case 'startDate':
      case 'endDate':
        return format.date(value)
      case 'rateAmount':
        return `${value} · ${t(period === 'day' ? 'agency:terms.perDay' : 'agency:terms.perHour')}`
      case 'hoursPerWeek':
        return t('jobs:aiDraft.previewHours', { count: Number(value) })
      default:
        return String(value)
    }
  }
}

/**
 * 2026-11-23 (owner chose "compare and pick per field"): when the posting already has text where the AI wrote
 * something else, each such field shows what is there now beside the AI's version, with "Use AI's version" and
 * "Use all". Nothing changes until a click; a used field gets the ✦ AI mark.
 */
export default function JobAiCompare({ fields, values, draft, agency, onUse, onUseAll }) {
  const { t } = useTranslation()
  const show = useShow(agency)
  if (!fields.length) return null
  return (
    <div className={styles.compare} data-job-ai-compare>
      <div className={styles.compareHead}>
        <div>
          <p className={styles.previewTitle}>{t('jobs:aiDraft.compareTitle', { total: fields.length })}</p>
          <p className={styles.text}>{t('jobs:aiDraft.compareText')}</p>
        </div>
        {fields.length > 1 && (
          <Button size="sm" variant="outline" leftIcon={<Icon as={Sparkles} size={13} />} onClick={onUseAll} data-ai-use-all>
            {t('jobs:aiDraft.useAll')}
          </Button>
        )}
      </div>
      <ul className={styles.compareList}>
        {fields.map((field) => (
          <li key={field} className={styles.compareRow} data-ai-compare={field}>
            <span className={styles.compareLabel}>{t(`jobs:aiDraft.fieldNames.${field}`)}</span>
            <div className={styles.compareValues}>
              <div className={styles.compareValue}>
                <span className={styles.compareTag}>{t('jobs:aiDraft.now')}</span>
                <div className={styles.compareNow}>{show(field, values[field], values.ratePeriod)}</div>
              </div>
              <div className={styles.compareValue}>
                <span className={styles.compareTag}>
                  <Icon as={Sparkles} size={11} /> {t('jobs:aiDraft.aiVersion')}
                </span>
                <div>{show(field, draft[field], draft.ratePeriod)}</div>
              </div>
            </div>
            <Button size="sm" onClick={() => onUse(field)} data-ai-use={field}>
              {t('jobs:aiDraft.use')}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
