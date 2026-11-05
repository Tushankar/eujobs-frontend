import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { BriefcaseBusiness, Search, SquarePen } from 'lucide-react'
import { Button, CompanyLogo, Icon, Panel, SelectField, Skeleton, SkeletonRegion } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import { useJobText } from '@/lib/jobText.js'
import { cx } from '@/utils/cx.js'
import styles from './RolePicker.module.css'

/** M-063: the chosen role on the left, "Compare with a role" (top 10 + saved + applied) on the right. */
export default function RolePicker({ roles, jobId, onChange, loading }) {
  const { t } = useTranslation('aiInsights')
  const jobText = useJobText()
  const job = roles.find((role) => role.id === jobId)
  if (loading) {
    return (
      <Panel className={styles.picker} padding={20}>
        <SkeletonRegion className={styles.summary}>
          <Skeleton shape="block" width={44} height={44} />
          <div className={styles.skeletonText}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="80%" />
          </div>
        </SkeletonRegion>
        <div className={cx(styles.field, styles.skeletonField)}>
          <span className={styles.skeletonLabel}>{t('picker.label')}</span>
          <Skeleton shape="block" height={44} />
        </div>
      </Panel>
    )
  }
  if (!roles.length) {
    return (
      <EmptyState
        size="lg"
        icon={BriefcaseBusiness}
        title={t('picker.noneTitle')}
        description={t('picker.noneText')}
        action={
          <div className={styles.emptyActions}>
            <Button as={Link} to="/candidate/jobs" leftIcon={<Icon as={Search} size={14} />}>
              {t('shell:nav.findJobs')}
            </Button>
            <Button as={Link} to="/candidate/profile" variant="outline" leftIcon={<Icon as={SquarePen} size={14} />}>
              {t('profile:edit')}
            </Button>
          </div>
        }
      />
    )
  }
  return (
    <Panel className={styles.picker} padding={20}>
      {job && (
        <div className={styles.summary}>
          <CompanyLogo name={job.company.displayName} id={job.company.id} src={job.company.logoUrl ?? undefined} size={44} />
          <div>
            <p className={styles.title}>{job.title}</p>
            <p className={styles.meta}>
              {[t('picker.meta', { company: job.company.displayName, mode: t(`enums:workPreference.${job.workPreference}`) }), job.salary && jobText.salary(job)].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
      )}
      <SelectField
        className={styles.field}
        name="role"
        label={t('picker.label')}
        value={jobId ?? ''}
        options={roles.map((role) => ({ value: role.id, label: `${role.title} · ${role.company.displayName}` }))}
        onChange={(event) => onChange(event.target.value)}
      />
    </Panel>
  )
}
