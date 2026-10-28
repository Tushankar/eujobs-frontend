import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Building2,
  BriefcaseBusiness,
  Check,
  ChevronUp,
  Globe,
  MapPin,
  SearchX,
  Sparkles,
  Users,
} from 'lucide-react'
import { cx } from '@/utils/cx.js'
import { Button, Icon } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import StatusBadge from '@/components/common/StatusBadge.jsx'
import aiGlyph from '@/assets/icons/ai-glyph-blue.svg'
import AiJobSummaryModal from '../components/AiJobSummaryModal.jsx'
import AiSummaryButton from '../components/AiSummaryButton.jsx'
import JobLogo from '../components/JobLogo.jsx'
import { ROLE_DETAILS, getJob } from '../data/jobs.js'
import { formatPosted, formatSalary, matchTone, profileMatch } from '../data/jobUtils.js'
import { useApplications } from '../hooks/useApplications.js'
import { useSavedJobs } from '../hooks/useSavedJobs.js'
import styles from './JobDetailsPage.module.css'

function BulletSection({ title, items }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.h2}>{title}</h2>
      <ul className={styles.bullets}>
        {items.map((item) => (
          <li key={item} className={styles.bullet}>
            {item}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Match breakdown (Job Details Page_5): headline %, collapsible AI insights with skills evidence and a human-review note. */
function MatchInsights({ job }) {
  const [open, setOpen] = useState(true)
  const aligned = job.skills.slice(0, job.matchingSkills)
  const missing = job.skills.slice(job.matchingSkills)
  const percent = profileMatch(job)

  return (
    <>
      <div className={styles.summaryCard}>
        <p className={styles.percent}>{percent}%</p>
        <div>
          <p className={styles.summaryTitle}>Match summary</p>
          <p className={styles.summaryText}>
            Based on {job.matchingSkills} of {job.skills.length} listed skills, your work preference, and reported experience.
            Review the evidence below before deciding.
          </p>
        </div>
      </div>

      <div className={styles.insights}>
        <button
          type="button"
          className={styles.insightsToggle}
          aria-expanded={open}
          aria-controls="match-insights-body"
          onClick={() => setOpen((current) => !current)}
        >
          <span className={styles.insightsLabel}>
            <img src={aiGlyph} alt="" width={14} height={14} />
            AI Match Insights
          </span>
          <Icon as={ChevronUp} size={14} className={cx(styles.chevron, !open && styles.chevronClosed)} />
        </button>
        <p className={styles.insightsSummary}>
          {job.matchingSkills} {job.matchingSkills === 1 ? 'skill aligns' : 'skills align'} with your profile · Matches your work
          preference
        </p>

        {open && (
          <div id="match-insights-body" className={styles.insightsBody}>
            <p className={styles.eyebrow}>Skills evidence</p>
            {aligned.length > 0 && (
              <ul className={styles.evidence} aria-label="Skills found in your profile">
                {aligned.map((skill) => (
                  <li key={skill} className={styles.evidenceChip}>
                    <Icon as={Check} size={10} strokeWidth={2.2} />
                    {skill}
                  </li>
                ))}
              </ul>
            )}
            <p className={styles.experience}>
              <Icon as={Check} size={13} />
              5 years of experience reported in the profile. Verify role-specific experience during review.
            </p>
            <div className={styles.gap}>
              <p className={styles.gapTitle}>Potential gap</p>
              <p className={styles.gapText}>
                {missing.length === 0
                  ? 'All listed required skills appear in your profile. Role-specific depth and proficiency still need human review.'
                  : `${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} not evidenced in your profile yet. Missing profile evidence does not mean you lack a skill.`}
              </p>
            </div>
          </div>
        )}
        <p className={styles.disclaimer}>
          Based on profile evidence and stated preferences, not a hiring decision. You remain in control.
        </p>
      </div>
    </>
  )
}

export default function JobDetailsPage() {
  const { jobId } = useParams()
  const job = getJob(jobId)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const { isSaved, toggleSaved } = useSavedJobs()
  const { hasApplied, applyTo } = useApplications()

  if (!job) {
    return (
      <div className={styles.page}>
        <Link to="/candidate/jobs" className={styles.back}>
          <Icon as={ArrowLeft} size={14} />
          Back to opportunities
        </Link>
        <EmptyState
          icon={SearchX}
          title="This job is no longer available"
          description="It may have been filled or removed. Browse the latest opportunities instead."
          action={
            <Button as={Link} to="/candidate/jobs">
              Find jobs
            </Button>
          }
        />
      </div>
    )
  }

  const saved = isSaved(job.id)
  const applied = hasApplied(job.id)

  return (
    <div className={styles.page}>
      <Link to="/candidate/jobs" className={styles.back}>
        <Icon as={ArrowLeft} size={14} />
        Back to opportunities
      </Link>

      <div className={styles.layout}>
        <article className={styles.article}>
          <header className={styles.hero}>
            <JobLogo company={job.company} logo={job.logo} />
            <div className={styles.heroText}>
              <div className={styles.heroRow}>
                <span className={styles.company}>{job.company}</span>
                <StatusBadge tone={matchTone(job)}>{job.matchLabel}</StatusBadge>
                <span className={styles.profileMatch}>
                  <Icon as={Sparkles} size={11} />
                  {profileMatch(job)}% profile match
                </span>
              </div>
              <p className={styles.posted}>
                {job.industry} · Posted {formatPosted(job.postedHoursAgo)}
              </p>
            </div>
            <AiSummaryButton onClick={() => setSummaryOpen(true)} />
          </header>

          <h1 className={styles.title}>{job.title}</h1>
          <p className={styles.tagline}>{job.tagline}</p>

          <div className={styles.meta}>
            <span className={styles.metaItem}>
              <Icon as={MapPin} size={14} />
              {job.location}
            </span>
            <span className={styles.metaItem}>
              <Icon as={Globe} size={14} />
              {job.workMode}
            </span>
            <span className={styles.metaItem}>
              <Icon as={BriefcaseBusiness} size={14} />
              {job.type}
            </span>
            <span className={styles.salary}>{formatSalary(job)} / year</span>
          </div>

          <section className={styles.why}>
            <div className={styles.whyHead}>
              <h2 className={styles.h2Tight}>Why this job matches you</h2>
              <Link to="/candidate/ai-insights/job-match" className={styles.insightLink}>
                View complete match insights
                <Icon as={ArrowRight} size={12} />
              </Link>
            </div>
            <MatchInsights job={job} />
          </section>

          <section className={styles.section}>
            <h2 className={styles.h2}>About the role</h2>
            <p className={styles.about}>{ROLE_DETAILS.about}</p>
          </section>
          <BulletSection title="The impact you’ll make" items={ROLE_DETAILS.impact} />
          <BulletSection title="What you’ll bring" items={ROLE_DETAILS.bring} />
          <section className={styles.section}>
            <h2 className={styles.h2}>Required skills</h2>
            <ul className={styles.skills}>
              {job.skills.map((skill) => (
                <li key={skill} className={styles.skill}>
                  {skill}
                </li>
              ))}
            </ul>
          </section>
          <BulletSection title="Nice to have" items={ROLE_DETAILS.niceToHave} />
          <BulletSection title="Room to do your best work" items={ROLE_DETAILS.perks} />
        </article>

        <aside className={styles.rail} aria-label="Apply and company">
          <section className={styles.card}>
            <h2 className={styles.railTitle}>Could this be your next chapter?</h2>
            <p className={styles.railText}>A good match is a starting point. The next step is yours.</p>
            <div className={styles.railActions}>
              {applied ? (
                <Button fullWidth disabled leftIcon={<Icon as={Check} size={14} />}>
                  Applied
                </Button>
              ) : (
                <Button fullWidth rightIcon={<Icon as={ArrowUpRight} size={14} />} onClick={() => applyTo(job.id)}>
                  Apply now
                </Button>
              )}
              <Button
                variant="secondary"
                fullWidth
                className={cx(styles.saveButton, saved && styles.saveButtonOn)}
                aria-pressed={saved}
                leftIcon={<Icon as={Bookmark} size={14} className={cx(saved && styles.filledIcon)} />}
                onClick={() => toggleSaved(job.id)}
              >
                {saved ? 'Saved for later' : 'Save for later'}
              </Button>
            </div>
            {applied ? (
              <p className={styles.success} role="status">
                Application submitted. Track it in{' '}
                <Link to="/candidate/applications" className={styles.successLink}>
                  Applications
                </Link>
                .
              </p>
            ) : (
              <p className={styles.consent}>Your information, shared with consent.</p>
            )}
          </section>

          <section className={styles.card}>
            <h2 className={styles.aboutTitle}>About {job.company}</h2>
            <p className={styles.aboutText}>{job.companyAbout}</p>
            <ul className={styles.facts}>
              <li>
                <Icon as={Building2} size={13} />
                {job.industry}
              </li>
              <li>
                <Icon as={Users} size={13} />
                {job.companySize}
              </li>
            </ul>
          </section>
        </aside>
      </div>

      <AiJobSummaryModal job={job} open={summaryOpen} onClose={() => setSummaryOpen(false)} applied={applied} onApply={applyTo} />
    </div>
  )
}
