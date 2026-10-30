import { Link } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness, Layers, ShieldCheck, TrendingUp } from 'lucide-react'
import StatCard from '@/components/common/StatCard.jsx'
import { Button, Icon, Panel } from '@/components/ui'
import sparkle from '@/assets/icons/ai-insights-sparkle-24.svg'
import AiPageShell from '../components/AiPageShell.jsx'
import MatchCard from '../components/MatchCard.jsx'
import SectionHeading from '../components/SectionHeading.jsx'
import { DEMO_OPPORTUNITY_COUNT, PROFILE, ROLES_WITH_ALIGNED_SKILLS, SKILL_DEMAND } from '../data/insights.js'
import { useAddedSkills } from '../hooks/useInsightsState.js'
import { rankRoles } from '../utils/matching.js'
import styles from './AiInsightsPage.module.css'

const AI_INSIGHTS = '/candidate/ai-insights'

/** Profile insights: a snapshot of the reviewed profile and the evidence behind the top role matches. */
export default function AiInsightsPage() {
  const { skills } = useAddedSkills()
  const topMatches = rankRoles(skills).slice(0, 4)

  return (
    <AiPageShell
      eyebrow="AI Profile Insights"
      title="Your potential, in perspective."
      description="Understand your strengths, see the evidence, and decide what comes next."
    >
      <Panel className={styles.profile} padding={24}>
        <span className={styles.avatar} aria-hidden="true">
          {PROFILE.initials}
        </span>
        <div className={styles.profileText}>
          <p className={styles.name}>{PROFILE.name}</p>
          <p className={styles.role}>
            {PROFILE.title} · {PROFILE.location}
          </p>
          <p className={styles.snapshot}>
            A snapshot of your reviewed information. Strengths here reflect listed evidence—not independently verified proficiency.
          </p>
        </div>
        <Button as={Link} to={`${AI_INSIGHTS}/improve-profile`} rightIcon={<Icon as={ArrowRight} size={13} strokeWidth={2} />}>
          Improve my profile
        </Button>
      </Panel>

      <div className={styles.stats}>
        <StatCard icon={Layers} label="Skills in your profile" value={skills.length} caption="Based on your reviewed information" />
        <StatCard
          icon={BriefcaseBusiness}
          label="Roles with aligned skills"
          value={ROLES_WITH_ALIGNED_SKILLS}
          caption="Among the current demo opportunities"
        />
        <StatCard icon={TrendingUp} label="Experience reported" value={`${PROFILE.yearsReported} yrs`} caption="Review for role-specific relevance" />
      </div>

      <div className={styles.split}>
        <Panel padding={24} className={styles.strengths} aria-labelledby="strengths-title">
          <SectionHeading
            id="strengths-title"
            title="Where your strengths stand out"
            description="Listed skills appearing in current opportunities"
          />
          <ul className={styles.skillList}>
            {skills.map((skill) => {
              const roles = SKILL_DEMAND[skill] ?? 0
              return (
                <li key={skill}>
                  <div className={styles.skillRow}>
                    <span>{skill}</span>
                    <span className={styles.roleCount}>
                      {roles} {roles === 1 ? 'role' : 'roles'}
                    </span>
                  </div>
                  <div
                    className={styles.bar}
                    role="progressbar"
                    aria-label={`${skill} appears in ${roles} of ${DEMO_OPPORTUNITY_COUNT} current roles`}
                    aria-valuemin={0}
                    aria-valuemax={DEMO_OPPORTUNITY_COUNT}
                    aria-valuenow={roles}
                  >
                    <span className={styles.fill} style={{ width: `${(roles / DEMO_OPPORTUNITY_COUNT) * 100}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
          <p className={styles.barNote}>Each bar shows how many of the {DEMO_OPPORTUNITY_COUNT} current demo opportunities list that skill.</p>
        </Panel>

        <div className={styles.side}>
          <Panel selected padding={28}>
            <img src={sparkle} alt="" width={24} height={24} />
            <h3 className={styles.evidenceTitle}>Make the evidence visible.</h3>
            <p className={styles.evidenceText}>
              Your Product Design experience is a useful starting point. Add concrete outcomes, project examples, and your
              contribution to help a recruiter understand the impact.
            </p>
            <Link to={`${AI_INSIGHTS}/improve-profile`} className={styles.link}>
              Strengthen my profile
              <Icon as={ArrowRight} size={13} strokeWidth={2} />
            </Link>
          </Panel>
          <Panel padding={24}>
            <span className={styles.shield}>
              <Icon as={ShieldCheck} size={22} strokeWidth={2} />
            </span>
            <h3 className={styles.contextTitle}>Context, not conclusions.</h3>
            <p className={styles.contextText}>
              These insights compare your listed skills with the available demo roles. They don’t infer protected characteristics,
              assess your worth, or make hiring decisions. A connected AI service would add semantic analysis with human review.
            </p>
          </Panel>
        </div>
      </div>

      <section className={styles.matches} aria-labelledby="matches-title">
        <SectionHeading
          id="matches-title"
          title="The evidence behind your matches"
          description="Ordered by listed skill overlap, work preference, then reported experience."
        >
          <Link to={`${AI_INSIGHTS}/skill-gap`} className={styles.link}>
            Explore skill gaps
            <Icon as={ArrowRight} size={13} strokeWidth={2} />
          </Link>
        </SectionHeading>
        <div className={styles.matchGrid}>
          {topMatches.map(({ role, match }) => (
            <MatchCard key={role.id} role={role} match={match} />
          ))}
        </div>
      </section>
    </AiPageShell>
  )
}
