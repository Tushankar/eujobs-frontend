import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness, Layers, ShieldCheck, TrendingUp } from 'lucide-react'
import StatCard from '@/components/common/StatCard.jsx'
import { Avatar, Button, Icon, Panel } from '@/components/ui'
import sparkle from '@/assets/icons/ai-insights-sparkle-24.svg'
import { useGetInsightsOverviewQuery } from '@/features/ai/api.js'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import AiPageShell from '../components/AiPageShell.jsx'
import MatchCard from '../components/MatchCard.jsx'
import Narrative from '../components/Narrative.jsx'
import SectionHeading from '../components/SectionHeading.jsx'
import styles from './AiInsightsPage.module.css'

const AI_INSIGHTS = '/candidate/ai-insights'

/** Profile insights (M-057, M-066): the profile at a glance, skill demand in the market and the best matches. */
export default function AiInsightsPage() {
  const { t } = useTranslation('aiInsights')
  const format = useFormat()
  const { me } = usePreferences()
  const { data } = useGetInsightsOverviewQuery()
  if (!data) return <AiPageShell eyebrow={t('overview.eyebrow')} title={t('overview.title')} description={t('overview.description')} />
  const { profile, stats, skillDemand, topMatches } = data
  const place = profile.location && [profile.location.city, format.country(profile.location.countryCode)].join(', ')

  return (
    <AiPageShell eyebrow={t('overview.eyebrow')} title={t('overview.title')} description={t('overview.description')}>
      <Panel className={styles.profile} padding={24}>
        <Avatar name={profile.fullName} src={me?.photoUrl ?? undefined} size={56} className={styles.avatar} />
        <div className={styles.profileText}>
          <p className={styles.name}>{profile.fullName}</p>
          <p className={styles.role}>{[profile.headline, place].filter(Boolean).join(' · ')}</p>
          <p className={styles.snapshot}>{t('overview.snapshot')}</p>
        </div>
        <Button as={Link} to={`${AI_INSIGHTS}/improve-profile`} rightIcon={<Icon as={ArrowRight} size={13} strokeWidth={2} />}>
          {t('overview.improve')}
        </Button>
      </Panel>

      <div className={styles.stats}>
        <StatCard icon={Layers} label={t('overview.stats.skills')} value={stats.skillsCount} caption={t('overview.stats.skillsCaption')} />
        <StatCard icon={BriefcaseBusiness} label={t('overview.stats.aligned')} value={stats.rolesWithAlignedSkills} caption={t('overview.stats.alignedCaption', { count: stats.jobsConsidered })} />
        <StatCard
          icon={TrendingUp}
          label={t('overview.stats.years')}
          value={stats.yearsExperience ?? 0}
          format={(count) => t('overview.stats.yearsValue', { count: Math.round(count) })}
          caption={t('overview.stats.yearsCaption')}
        />
      </div>

      <div className={styles.split}>
        <Panel padding={24} className={styles.strengths} aria-labelledby="strengths-title">
          <SectionHeading id="strengths-title" title={t('overview.strengths')} description={t('overview.strengthsLead')} />
          {skillDemand.length === 0 ? (
            <p className={styles.barNote}>{t('overview.noSkills')}</p>
          ) : (
            <>
              <ul className={styles.skillList}>
                {skillDemand.map(({ skill, jobCount }) => (
                  <li key={skill} data-skill-demand={skill}>
                    <div className={styles.skillRow}>
                      <span>{skill}</span>
                      <span className={styles.roleCount}>{t('overview.roles', { count: jobCount })}</span>
                    </div>
                    <div
                      className={styles.bar}
                      role="progressbar"
                      aria-label={t('overview.barLabel', { skill, count: jobCount, total: stats.jobsConsidered })}
                      aria-valuemin={0}
                      aria-valuemax={stats.jobsConsidered}
                      aria-valuenow={jobCount}
                    >
                      <span className={styles.fill} style={{ width: `${stats.jobsConsidered ? (jobCount / stats.jobsConsidered) * 100 : 0}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
              <p className={styles.barNote}>{t('overview.barNote', { count: stats.jobsConsidered })}</p>
            </>
          )}
        </Panel>

        <div className={styles.side}>
          <Panel padding={28}>
            <img src={sparkle} alt="" width={24} height={24} />
            <h3 className={styles.evidenceTitle}>{t('overview.evidenceTitle')}</h3>
            <Narrative section="overview">{(narrative) => <p className={styles.evidenceText}>{narrative.text}</p>}</Narrative>
            <Link to={`${AI_INSIGHTS}/improve-profile`} className={styles.link}>
              {t('overview.strengthen')}
              <Icon as={ArrowRight} size={13} strokeWidth={2} />
            </Link>
          </Panel>
          <Panel padding={24}>
            <span className={styles.shield}>
              <Icon as={ShieldCheck} size={22} strokeWidth={2} />
            </span>
            <h3 className={styles.contextTitle}>{t('overview.contextTitle')}</h3>
            <p className={styles.contextText}>{t('overview.contextText')}</p>
          </Panel>
        </div>
      </div>

      <section className={styles.matches} aria-labelledby="matches-title">
        <SectionHeading id="matches-title" title={t('overview.matches')} description={t('overview.matchesLead')}>
          <Link to={`${AI_INSIGHTS}/skill-gap`} className={styles.link}>
            {t('overview.exploreGaps')}
            <Icon as={ArrowRight} size={13} strokeWidth={2} />
          </Link>
        </SectionHeading>
        {topMatches.length ? (
          <div className={styles.matchGrid}>
            {topMatches.map((job) => (
              <MatchCard key={job.id} job={job} />
            ))}
          </div>
        ) : (
          <p className={styles.barNote}>{t('overview.noMatches')}</p>
        )}
      </section>
    </AiPageShell>
  )
}
