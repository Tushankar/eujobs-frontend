import { useTranslation } from 'react-i18next'
import { LockKeyhole } from 'lucide-react'
import { Icon, Panel } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { useFormat } from '@/lib/preferences.js'
import styles from './ComparePanel.module.css'

/** A version's confirmed snapshot, else its AI proposal (M-027). */
const snapshotOf = (version) => version.snapshot ?? version.pendingSnapshot

/**
 * Side panel of the CV page (P3-Q3, back in Phase 9): role, experience and skills of up to two chosen versions, as their
 * snapshots record them, and the skills only one of them lists.
 */
export default function ComparePanel({ selected }) {
  const { t } = useTranslation('cv')
  const format = useFormat()
  const ordered = [...selected].sort((a, b) => a.number - b.number)
  const keys = (version) => new Set(snapshotOf(version).skills.map((skill) => skill.toLocaleLowerCase()))
  const only = (version, other) => snapshotOf(version).skills.filter((skill) => !keys(other).has(skill.toLocaleLowerCase()))

  return (
    <Panel as="aside" padding={20} className={styles.panel} aria-labelledby="compare-heading" data-compare-panel>
      <h2 className={styles.heading} id="compare-heading">
        {t('compare.title')}
      </h2>
      <p className={styles.lead}>{t('compare.lead')}</p>

      {ordered.length === 0 ? (
        <p className={styles.empty}>{t('compare.empty')}</p>
      ) : (
        <div className={styles.snapshots} aria-live="polite">
          {ordered.map((version) => {
            const snapshot = snapshotOf(version)
            return (
              <section key={version.id} className={styles.snapshot} data-compare-version={version.number}>
                <h3 className={styles.snapshotTitle}>
                  {t('compare.version', { number: version.number })}
                  {!version.snapshot && <PillBadge tone="warning">{t('compare.proposed')}</PillBadge>}
                </h3>
                <dl className={styles.facts}>
                  <dt>{t('compare.role')}</dt>
                  <dd>{snapshot.role}</dd>
                  <dt>{t('compare.experience')}</dt>
                  <dd>{t('compare.years', { count: snapshot.years })}</dd>
                  <dt>{t('compare.skills')}</dt>
                  <dd>
                    <ul className={styles.skills}>
                      {snapshot.skills.map((skill) => (
                        <li key={skill}>
                          <PillBadge tone="primary">{skill}</PillBadge>
                        </li>
                      ))}
                    </ul>
                  </dd>
                </dl>
              </section>
            )
          })}
          {ordered.length === 2 && (
            <p className={styles.difference} data-compare-difference>
              {only(ordered[1], ordered[0]).length || only(ordered[0], ordered[1]).length
                ? [
                    only(ordered[1], ordered[0]).length && t('compare.onlyIn', { number: ordered[1].number, skills: format.list(only(ordered[1], ordered[0])) }),
                    only(ordered[0], ordered[1]).length && t('compare.onlyIn', { number: ordered[0].number, skills: format.list(only(ordered[0], ordered[1])) }),
                  ]
                    .filter(Boolean)
                    .join(' ')
                : t('compare.same', { first: ordered[0].number, second: ordered[1].number })}
            </p>
          )}
        </div>
      )}

      <div className={styles.notice}>
        <span className={styles.noticeIcon}>
          <Icon as={LockKeyhole} size={16} />
        </span>
        <p>{t('compare.notice')}</p>
      </div>
    </Panel>
  )
}
