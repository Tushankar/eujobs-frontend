import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Sparkles } from 'lucide-react'
import { Avatar, Icon, Panel, SelectField } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { useGetOversightQuery } from '../api.js'
import styles from './OversightSection.module.css'

/** M-057: the code-computed evidence for one candidate and job; no AI wrote any of it. */
function Evidence({ name, evidence }) {
  const { t } = useTranslation('aiMatching')
  const format = useFormat()
  const level = (key) => t(`enums:languageLevel.${key}`)
  const { years, workMode } = evidence
  return (
    <Panel padding={16} selected className={styles.insight} data-evidence>
      <p className={styles.insightTitle}>
        <Icon as={Sparkles} size={13} />
        {t('evidence.title', { name })}
      </p>
      <p className={styles.summary}>{t('evidence.subtitle')}</p>
      <div className={styles.detail}>
        <p className={styles.eyebrow}>{t('evidence.matched')}</p>
        <div className={styles.skills}>
          {evidence.matchedSkills.length ? (
            evidence.matchedSkills.map((skill) => (
              <PillBadge tone="success" key={skill}>
                <Icon as={Check} size={10} />
                {skill}
              </PillBadge>
            ))
          ) : (
            <p className={styles.summary}>{t('evidence.none')}</p>
          )}
        </div>
        <p className={styles.experience}>
          <Icon as={Check} size={13} />
          {years.required == null ? t('evidence.yearsNoRequirement', { candidate: years.candidate ?? 0 }) : t('evidence.years', { candidate: years.candidate ?? 0, required: years.required })}
        </p>
        {workMode.candidate && workMode.job && (
          <p className={styles.experience}>
            <Icon as={Check} size={13} />
            {t('evidence.workMode', { candidate: t(`enums:workPreference.${workMode.candidate}`), job: t(`enums:workPreference.${workMode.job}`) })}
          </p>
        )}
        <p className={styles.experience}>
          <Icon as={Check} size={13} />
          {t(evidence.location.met ? 'evidence.location.met' : 'evidence.location.notMet')}
        </p>
        {evidence.rightToWork !== null && (
          <p className={styles.experience}>
            <Icon as={Check} size={13} />
            {t(`evidence.rightToWork.${evidence.rightToWork}`)}
          </p>
        )}
        {evidence.languages.length > 0 && (
          <>
            <p className={cx(styles.eyebrow, styles.spaced)}>{t('evidence.languages')}</p>
            <ul className={styles.languages}>
              {evidence.languages.map((language) => (
                <li key={language.code}>
                  {language.level
                    ? t('evidence.language', { language: format.languageName(language.code), minLevel: level(language.minLevel), level: level(language.level) })
                    : t('evidence.languageMissing', { language: format.languageName(language.code), minLevel: level(language.minLevel) })}
                </li>
              ))}
            </ul>
          </>
        )}
        {evidence.missingSkills.length > 0 && (
          <div className={styles.gap}>
            <p className={styles.gapTitle}>{t('evidence.missing')}</p>
            <p>{format.list(evidence.missingSkills)}</p>
          </div>
        )}
        <p className={styles.disclaimer}>{t('evidence.disclaimer')}</p>
      </div>
    </Panel>
  )
}

/**
 * Oversight (M-068): pick a published job (default the newest); its top 4 candidates by match score with the
 * percentage (admins see %, C6), and the evidence for the selected one (default the first).
 */
export default function OversightSection() {
  const { t } = useTranslation('aiMatching')
  const format = useFormat()
  const [selection, setSelection] = useState({})
  const { data } = useGetOversightQuery(Object.fromEntries(Object.entries(selection).filter(([, value]) => value)))
  if (!data) return null
  const selected = data.candidates.find((candidate) => candidate.id === data.selected?.candidateId)

  return (
    <section className={styles.section} aria-labelledby="oversight-title">
      <SectionTitle id="oversight-title" title={t('oversight.title')} description={t('oversight.description')} />
      {data.job ? (
        <>
          <SelectField
            className={styles.jobPicker}
            name="oversightJob"
            label={t('oversight.job')}
            value={data.job.id}
            onChange={(event) => setSelection({ jobId: event.target.value })}
            options={data.jobs.map((job) => ({ value: job.id, label: job.company ? `${job.title} · ${job.company}` : job.title }))}
          />
          {data.candidates.length ? (
            <div className={styles.cards}>
              {data.candidates.map((candidate) => (
                <button
                  type="button"
                  key={candidate.id}
                  className={cx(styles.card, candidate.id === selected?.id && styles.cardSelected)}
                  aria-pressed={candidate.id === selected?.id}
                  aria-label={t('oversight.select', { name: candidate.fullName })}
                  data-candidate={candidate.id}
                  onClick={() => setSelection({ jobId: data.job.id, candidateId: candidate.id })}
                >
                  <span className={styles.person}>
                    <Avatar name={candidate.fullName} src={candidate.photoUrl ?? undefined} size={36} />
                    <span className={styles.personText}>
                      <span className={styles.name}>{candidate.fullName}</span>
                      <span className={styles.role}>{candidate.headline}</span>
                    </span>
                  </span>
                  <span className={styles.percent} aria-label={t('oversight.percentLabel', { score: format.number(candidate.score / 100, { style: 'percent' }) })}>
                    {format.number(candidate.score / 100, { style: 'percent' })}
                  </span>
                  {candidate.label && <PillBadge tone={candidate.label === 'strong' ? 'success' : 'info'}>{t(`enums:matchLabel.${candidate.label}`)}</PillBadge>}
                  <span className={styles.caption}>{t('oversight.caption')}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>{t('oversight.noCandidates')}</p>
          )}
          {selected && <Evidence name={selected.fullName} evidence={data.selected.evidence} />}
        </>
      ) : (
        <p className={styles.empty}>{t('oversight.noJobs')}</p>
      )}
    </section>
  )
}
