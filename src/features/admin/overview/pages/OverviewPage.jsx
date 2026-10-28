import { Link } from 'react-router-dom'
import { Award, BookOpen, BriefcaseBusiness, Download, FileText, ShieldCheck, TrendingUp, Users } from 'lucide-react'
import PageTitle from '@/components/common/PageTitle.jsx'
import StatCard from '@/components/common/StatCard.jsx'
import { Button, Icon } from '@/components/ui'
import aiNavIcon from '@/assets/icons/ai-nav.svg'
import { useJobs } from '@/features/recruiter/jobs/hooks/useJobs.js'
import { downloadCsv } from '@/utils/downloadCsv.js'
import { ADMIN_USERS } from '../../shared/data/users.js'
import DemandedSkillsCard from '../components/DemandedSkillsCard.jsx'
import MarketplaceHealthCard from '../components/MarketplaceHealthCard.jsx'
import PlatformActivityCard from '../components/PlatformActivityCard.jsx'
import RecentActivityCard from '../components/RecentActivityCard.jsx'
import { DEMANDED_SKILLS, MARKETPLACE_HEALTH, OVERVIEW_STATS, RECENT_ACTIVITY } from '../data/overview.js'
import styles from './OverviewPage.module.css'

export default function OverviewPage() {
  const { jobs } = useJobs()

  const candidates = ADMIN_USERS.filter((user) => user.role === 'Candidate')
  const activeUsers = ADMIN_USERS.filter((user) => user.status === 'active')
  const pendingUsers = ADMIN_USERS.filter((user) => user.status === 'pending')
  const publishedJobs = jobs.filter((job) => job.status === 'published')

  const stats = [
    { label: 'Candidate registrations', value: candidates.length, caption: 'Users in this demo workspace', icon: Users, to: '/admin/candidates' },
    { label: 'Active users', value: activeUsers.length, caption: 'Accounts with active status', icon: TrendingUp, to: '/admin/candidates' },
    { label: 'Published jobs', value: publishedJobs.length, caption: 'Open in the demo marketplace', icon: BriefcaseBusiness, to: '/admin/jobs' },
    { label: 'Applications', value: OVERVIEW_STATS.applications, caption: 'Candidate and recruiter activity', icon: FileText, to: '/admin/applications' },
    {
      label: 'Verified candidate profiles',
      value: OVERVIEW_STATS.verifiedProfiles,
      caption: 'All named credential checks complete',
      icon: ShieldCheck,
      to: '/admin/moderation',
    },
    {
      label: 'Course enrollments',
      value: OVERVIEW_STATS.courseEnrollments,
      caption: 'Candidate learning currently underway',
      icon: BookOpen,
      to: '/admin/courses',
    },
    {
      label: 'Course badges earned',
      value: OVERVIEW_STATS.courseBadges,
      caption: 'Assessments completed in the demo',
      icon: Award,
      to: '/admin/courses',
    },
    {
      label: 'Average role match',
      value: OVERVIEW_STATS.averageRoleMatch,
      caption: 'Evidence summary for Senior Product Designer',
      iconSrc: aiNavIcon,
      to: '/admin/ai-matching',
    },
  ]

  const health = MARKETPLACE_HEALTH.map((item) => (item.key === 'pendingReviews' ? { ...item, value: pendingUsers.length } : item))

  function exportReport() {
    downloadCsv(
      [['Metric', 'Value'], ...stats.map((stat) => [stat.label, stat.value]), ...health.map((item) => [item.label, item.value])],
      'platform-overview.csv',
    )
  }

  return (
    <>
      <PageTitle
        eyebrow="Platform overview"
        title="A healthier marketplace. By design."
        description="Clear signals, thoughtful oversight, and responsible AI at every step."
        actions={
          <Button variant="outline" leftIcon={<Icon as={Download} size={14} />} onClick={exportReport}>
            Export report
          </Button>
        }
      />

      <div className={styles.stats}>
        {stats.map(({ to, ...stat }) => (
          <Link key={stat.label} to={to} className={styles.statLink}>
            <StatCard {...stat} />
          </Link>
        ))}
      </div>

      <div className={styles.activity}>
        <PlatformActivityCard />
        <MarketplaceHealthCard items={health} />
      </div>

      <div className={styles.insights}>
        <DemandedSkillsCard skills={DEMANDED_SKILLS} />
        <RecentActivityCard items={RECENT_ACTIVITY} />
      </div>
    </>
  )
}
