import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness, Bookmark, FileText, Plus } from 'lucide-react'
import { useGetMeQuery } from '@/app/api.js'
import PlanButton from '@/features/candidate/billing/components/PlanButton.jsx'
import { lacksEntitlement } from '@/features/candidate/billing/usePlan.js'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import StatCard from '@/components/common/StatCard.jsx'
import { Button, Icon } from '@/components/ui'
import aiNavIcon from '@/assets/icons/ai-nav.svg'
import { useGetRecruiterOverviewQuery, useGetTalentQuery, useShortlistToggle } from '@/features/recruiter/find-candidates/api.js'
import { useGetRecruiterJobsQuery } from '../../jobs/api.js'
import JobsTable from '../../jobs/components/JobsTable.jsx'
import HiringFunnelCard from '../components/HiringFunnelCard.jsx'
import HiringMomentumCard from '../components/HiringMomentumCard.jsx'
import SectionHeading from '../components/SectionHeading.jsx'
import TalentCard from '../components/TalentCard.jsx'
import styles from './OverviewPage.module.css'
import { useMarkSeen } from '@/features/notifications/api.js'

const ROLES_SHOWN = 5

/** M-202: the part of day from the browser's local time. */
function partOfDay(hour) {
  if (hour < 12) return 'morning'
  return hour < 18 ? 'afternoon' : 'evening'
}

/**
 * Recruiter Overview (§3.15, A: recruiter A9): open positions, recommended candidates (M-051 fallback until Phase 9),
 * active applications (M-082) and the shortlist; hiring momentum (M-083, M-170) and the funnel (M-178); talent worth
 * meeting; open roles.
 */
export default function OverviewPage() {
  // P11b-Q10: opening this item marks its notifications read.
  useMarkSeen('page', 'overview')
  const { t } = useTranslation()
  const { data: me } = useGetMeQuery()
  const { data: overview } = useGetRecruiterOverviewQuery()
  // P11c-Q15: the talent list needs Recruiter Plus; its count (Recommended candidates) stays.
  const talentLocked = lacksEntitlement(me, 'discovery', ['recruiter'])
  const { data: talent } = useGetTalentQuery(undefined, { skip: !me || talentLocked })
  const { data: jobs } = useGetRecruiterJobsQuery()
  const toggleShortlist = useShortlistToggle()
  // Read once per visit, so the greeting does not change while the page is open.
  const [dayPart] = useState(() => partOfDay(new Date().getHours()))
  const openRoles = (jobs?.items ?? []).filter((job) => job.status === 'published')
  const firstName = me?.fullName.split(/\s+/)[0] ?? ''

  const stats = [
    { key: 'openPositions', value: overview?.openPositions, icon: BriefcaseBusiness, to: '/recruiter/jobs' },
    { key: 'recommended', value: overview?.recommendedCandidates, iconSrc: aiNavIcon, to: '/recruiter/find-candidates' },
    { key: 'applications', value: overview?.applications, icon: FileText, to: '/recruiter/applications' },
    { key: 'shortlisted', value: overview?.shortlisted, icon: Bookmark, to: '/recruiter/shortlists' },
  ]
  const createButton = (
    <Button as={Link} to="/recruiter/jobs/new" leftIcon={<Icon as={Plus} size={14} />}>
      {t('discovery:overview.createJob')}
    </Button>
  )

  return (
    <>
      <PageTitle
        eyebrow={t(`discovery:overview.${dayPart}`, { name: firstName })}
        title={t('discovery:overview.title')}
        description={t('discovery:overview.description')}
        actions={<div className={styles.actions}>{createButton}</div>}
      />

      <div className={styles.stats}>
        {stats.map(({ key, to, value, ...stat }) => (
          <Link key={key} to={to} className={styles.statLink} data-stat={key}>
            <StatCard label={t(`discovery:overview.stats.${key}`)} caption={t(`discovery:overview.stats.${key}Caption`)} value={value ?? 0} {...stat} />
          </Link>
        ))}
      </div>

      <div className={styles.momentum}>
        <HiringMomentumCard />
        <HiringFunnelCard />
      </div>

      <div className={styles.sectionHead}>
        <SectionHeading title={t('discovery:overview.talent')} description={t('discovery:overview.talentDescription')} />
        <Link to="/recruiter/find-candidates" className={styles.sectionLink}>
          {t('discovery:overview.talentLink')}
          <Icon as={ArrowRight} size={12} />
        </Link>
      </div>
      {talentLocked ? (
        <div className={styles.talentLocked}>
          <p className={styles.talentEmpty}>{t('discovery:locked.talent')}</p>
          <PlanButton variant="outline" size="sm" entitlement="discovery" roles={['recruiter']}>
            {t('discovery:locked.seeCandidates')}
          </PlanButton>
        </div>
      ) : talent && talent.items.length === 0 ? (
        <p className={styles.talentEmpty}>{t('discovery:overview.talentEmpty')}</p>
      ) : (
        <div className={styles.talent}>
          {talent?.items.map((person) => (
            <TalentCard key={person.id} person={person} onToggleSaved={() => toggleShortlist(person)} />
          ))}
        </div>
      )}

      <div className={styles.rolesHead}>
        <SectionHeading title={t('discovery:overview.openRoles')} />
        {openRoles.length > ROLES_SHOWN && (
          <Link to="/recruiter/jobs" className={styles.sectionLink}>
            {t('discovery:overview.viewAll')}
            <Icon as={ArrowRight} size={12} />
          </Link>
        )}
      </div>
      <div className={styles.roles}>
        {!jobs ? null : openRoles.length > 0 ? (
          <JobsTable jobs={openRoles.slice(0, ROLES_SHOWN)} caption={t('discovery:overview.openRoles')} />
        ) : (
          <EmptyState icon={BriefcaseBusiness} title={t('discovery:overview.noRoles')} description={t('discovery:overview.noRolesText')} action={createButton} />
        )}
      </div>
    </>
  )
}
