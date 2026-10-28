import { Link } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness, Bookmark, FileText, Plus } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import StatCard from '@/components/common/StatCard.jsx'
import { Button, Icon } from '@/components/ui'
import { useLocalStorage } from '@/hooks/useLocalStorage.js'
import aiNavIcon from '@/assets/icons/ai-nav.svg'
import AiJobSummary from '../../jobs/components/AiJobSummary.jsx'
import JobsTable from '../../jobs/components/JobsTable.jsx'
import { useJobs } from '../../jobs/hooks/useJobs.js'
import HiringFunnelCard from '../components/HiringFunnelCard.jsx'
import HiringMomentumCard from '../components/HiringMomentumCard.jsx'
import SectionHeading from '../components/SectionHeading.jsx'
import TalentCard from '../components/TalentCard.jsx'
import { INITIAL_SAVED_TALENT, OVERVIEW_STATS, TALENT } from '../data/overview.js'
import styles from './OverviewPage.module.css'

const ROLES_SHOWN = 5

export default function OverviewPage() {
  const { jobs, setStatus } = useJobs()
  const [savedTalent, setSavedTalent] = useLocalStorage('lwm.recruiter.overview.savedTalent', INITIAL_SAVED_TALENT)

  const openRoles = jobs.filter((job) => job.status === 'published')
  const stats = [
    {
      label: 'Open positions',
      value: openRoles.length,
      caption: 'Ready for the right people',
      icon: BriefcaseBusiness,
      to: '/recruiter/jobs',
    },
    {
      label: 'Recommended candidates',
      value: OVERVIEW_STATS.recommendedCandidates,
      caption: 'Evidence-led recommendations',
      iconSrc: aiNavIcon,
      to: '/recruiter/find-candidates',
    },
    {
      label: 'Applications',
      value: OVERVIEW_STATS.applications,
      caption: 'Across your current workspace',
      icon: FileText,
      to: '/recruiter/applications',
    },
    {
      label: 'Shortlisted candidates',
      value: OVERVIEW_STATS.shortlistedCandidates,
      caption: 'A considered selection',
      icon: Bookmark,
      to: '/recruiter/shortlists',
    },
  ]

  function toggleSaved(id) {
    setSavedTalent((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  return (
    <>
      <PageTitle
        eyebrow="Good morning, Sarah"
        title="Great teams start with a good match."
        description="Less noise. More relevant talent. Move your hiring forward with confidence."
        actions={
          <div className={styles.actions}>
            <AiJobSummary jobs={openRoles} label="Ai Job Summary" />
            <Button as={Link} to="/recruiter/jobs/new" leftIcon={<Icon as={Plus} size={14} />}>
              Create a job
            </Button>
          </div>
        }
      />

      <div className={styles.stats}>
        {stats.map(({ to, ...stat }) => (
          <Link key={stat.label} to={to} className={styles.statLink}>
            <StatCard {...stat} />
          </Link>
        ))}
      </div>

      <div className={styles.momentum}>
        <HiringMomentumCard />
        <HiringFunnelCard />
      </div>

      <div className={styles.sectionHead}>
        <SectionHeading
          title="Talent worth meeting"
          description="Based on role requirements. Your review makes the difference."
        />
        <Link to="/recruiter/find-candidates" className={styles.sectionLink}>
          Discover talent
          <Icon as={ArrowRight} size={12} />
        </Link>
      </div>
      <div className={styles.talent}>
        {TALENT.map((person) => (
          <TalentCard
            key={person.id}
            person={person}
            saved={savedTalent.includes(person.id)}
            onToggleSaved={() => toggleSaved(person.id)}
          />
        ))}
      </div>

      <div className={styles.rolesHead}>
        <SectionHeading title="Your open roles" />
        {openRoles.length > ROLES_SHOWN && (
          <Link to="/recruiter/jobs" className={styles.sectionLink}>
            View all jobs
            <Icon as={ArrowRight} size={12} />
          </Link>
        )}
      </div>
      <div className={styles.roles}>
        {openRoles.length > 0 ? (
          <JobsTable jobs={openRoles.slice(0, ROLES_SHOWN)} onStatusChange={setStatus} caption="Your open roles" />
        ) : (
          <EmptyState
            icon={BriefcaseBusiness}
            title="No open roles"
            description="Published jobs appear here. Create a job to start meeting relevant talent."
            action={
              <Button as={Link} to="/recruiter/jobs/new" leftIcon={<Icon as={Plus} size={14} />}>
                Create a job
              </Button>
            }
          />
        )}
      </div>
    </>
  )
}
