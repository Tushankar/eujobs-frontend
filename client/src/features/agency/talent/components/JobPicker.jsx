import { useTranslation } from 'react-i18next'
import { BriefcaseBusiness, Check, ChevronDown, Users } from 'lucide-react'
import { Dropdown, Field, Icon } from '@/components/ui'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import fieldStyles from '@/components/ui/Field.module.css'
import styles from './JobPicker.module.css'

/**
 * 2026-11-23 (owner: "update the UI here properly"; the browser's own list looked out of place): Talent › On the books,
 * who to show. "Everyone on the books" first, then each agency job with its dates (and Draft / Paused), the chosen one
 * ticked. `value` '' is everyone.
 */
export default function JobPicker({ jobs, value, onChange }) {
  const { t } = useTranslation()
  const format = useFormat()
  const dates = (job) => (job.agency?.startDate ? t('agency:placements.range', { start: format.date(job.agency.startDate), end: format.date(job.agency.endDate) }) : '')
  const meta = (job) => [dates(job), job.status !== 'published' && t(`enums:jobStatus.${job.status}`)].filter(Boolean).join(' · ')
  const options = [
    { id: '', icon: Users, name: t('agency:ranking.everyone'), meta: t('agency:ranking.everyoneMeta') },
    ...jobs.map((job) => ({ id: job.id, icon: BriefcaseBusiness, name: job.title, meta: meta(job) })),
  ]
  const chosen = options.find((option) => option.id === value) ?? options[0]

  const row = (option) => (
    <>
      <span className={styles.icon} aria-hidden="true">
        <Icon as={option.icon} size={16} />
      </span>
      <span className={styles.text}>
        <span className={styles.name}>{option.name}</span>
        {option.meta && <span className={styles.meta}>{option.meta}</span>}
      </span>
    </>
  )

  return (
    <Field id="rank-for" label={t('agency:ranking.rankFor')}>
      {() => (
        <Dropdown
          align="start"
          className={styles.root}
          panelClassName={styles.panel}
          trigger={(props) => (
            <button {...props} id="rank-for" type="button" className={cx(fieldStyles.control, styles.trigger)} data-rank-for={chosen.id || 'everyone'}>
              <span className={styles.chosen}>{row(chosen)}</span>
              <Icon as={ChevronDown} size={16} className={styles.chevron} />
            </button>
          )}
        >
          {({ close }) => (
            <div role="listbox" aria-label={t('agency:ranking.rankFor')}>
              {options.map((option, index) => (
                <button
                  key={option.id || 'everyone'}
                  type="button"
                  role="option"
                  aria-selected={option.id === chosen.id}
                  className={cx(styles.option, option.id === chosen.id && styles.active, index === 0 && styles.first)}
                  onClick={() => {
                    onChange(option.id)
                    close()
                  }}
                  data-rank-option={option.id ? option.name : 'everyone'}
                >
                  {row(option)}
                  {option.id === chosen.id && <Icon as={Check} size={16} className={styles.check} />}
                </button>
              ))}
            </div>
          )}
        </Dropdown>
      )}
    </Field>
  )
}
