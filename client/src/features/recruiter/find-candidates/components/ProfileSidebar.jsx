import { useTranslation } from 'react-i18next'
import { Bookmark, ShieldCheck } from 'lucide-react'
import { Button, Icon, Panel, SelectField } from '@/components/ui'
import MatchInsights from './MatchInsights.jsx'
import styles from './ProfileSidebar.module.css'

/**
 * Right column of the candidate profile: the shortlist action, the job to match against and the evidence panel.
 * Messaging (Phase 7) and the stage select (Phase 6) come with their phases (P4-Q1).
 */
export default function ProfileSidebar({ candidate, jobs, job, onJobChange, onToggleShortlist }) {
  const { t } = useTranslation()
  return (
    <aside className={styles.sidebar}>
      <Panel padding={20}>
        <div className={styles.actions}>
          <Button variant="outline" fullWidth leftIcon={<Icon as={Bookmark} size={14} strokeWidth={2} />} aria-pressed={candidate.shortlisted} onClick={onToggleShortlist}>
            {t(candidate.shortlisted ? 'discovery:profile.removeShortlist' : 'discovery:profile.addShortlist')}
          </Button>
        </div>
      </Panel>

      <Panel padding={20} className={styles.evidence}>
        <SelectField
          className={styles.job}
          label={t('discovery:profile.matchFor')}
          value={job?.id ?? ''}
          disabled={jobs.length === 0}
          onChange={(event) => onJobChange(event.target.value)}
          options={jobs.length > 0 ? jobs.map((item) => ({ value: item.id, label: item.title })) : [{ value: '', label: t('discovery:toolbar.noJobs') }]}
        />
        <MatchInsights candidate={candidate} hasJob={Boolean(job)} defaultOpen />
      </Panel>

      <p className={styles.reminder}>
        <Icon as={ShieldCheck} size={17} strokeWidth={2} />
        {t('discovery:profile.reminder')}
      </p>
    </aside>
  )
}
