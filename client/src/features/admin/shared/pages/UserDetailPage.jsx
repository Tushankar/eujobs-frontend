import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, ShieldCheck, UserX } from 'lucide-react'
import { errorCode } from '@/app/api.js'
import { can } from '@/app/permissions.js'
import { WORKSPACES, workspacePath } from '@/app/workspaces.js'
import EmptyState from '@/components/common/EmptyState.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { Avatar, Icon, Panel, Skeleton, SkeletonRegion } from '@/components/ui'
import { useAuditText } from '@/features/admin/audit-logs/useAuditText.js'
import { useGetAdminFileUrlQuery } from '@/features/admin/moderation/api.js'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import { useGetAdminUserQuery } from '../api.js'
import { CATEGORY_ICONS, STATE_TONES, STATUS_TONES, SUBMISSION_TONES, VERIFICATION_TONES } from '../tones.js'
import styles from './UserDetailPage.module.css'

/** One labelled section of facts; `rows` = [label, value] pairs (empty values are skipped); `badge` sits beside the title. */
function Facts({ title, badge, rows, children }) {
  return (
    <Panel className={styles.section} aria-label={title}>
      <div className={styles.headingRow}>
        <h2 className={styles.heading}>{title}</h2>
        {badge}
      </div>
      {rows && (
        <dl className={styles.facts}>
          {rows
            .filter(([, value]) => value !== null && value !== undefined && value !== '' && value !== false)
            .map(([label, value]) => (
              <div key={label} className={styles.fact}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
        </dl>
      )}
      {children}
    </Panel>
  )
}

/** A sensitive file through /admin/files (§2.6); the link is signed for this admin and lives 10–15 minutes. */
function FileLink({ fileId, name }) {
  const { t } = useTranslation('adminUsers')
  const { data, isLoading } = useGetAdminFileUrlQuery(fileId)
  const label = name ?? t('detail.openFile')
  if (isLoading) return <Skeleton shape="pill" width={120} height={28} />
  return data ? (
    <a className={styles.file} href={`${import.meta.env.VITE_API_URL ?? ''}${data.url}`} target="_blank" rel="noopener noreferrer" title={label}>
      <Icon as={FileText} size={14} />
      <span className={styles.fileName}>{label}</span>
    </a>
  ) : null
}

/** Entries of a list section, or its empty text. */
function List({ items, empty, render }) {
  return items.length ? <ul className={styles.list}>{items.map(render)}</ul> : <p className={styles.muted}>{empty}</p>
}

function History({ events }) {
  const { t } = useTranslation(['adminUsers', 'enums'])
  const format = useFormat()
  const auditText = useAuditText()
  return (
    <Facts title={t('detail.history')}>
      <List
        items={events}
        empty={t('detail.noHistory')}
        render={(event) => (
          <li key={event.id} className={styles.item}>
            <span>{auditText(event)}</span>
            <span className={styles.muted}>
              {[event.actor.name ?? t(`enums:actorType.${event.actor.type}`), format.dateTime(event.at)].join(' · ')}
            </span>
          </li>
        )}
      />
    </Facts>
  )
}

function Learning({ learning }) {
  const { t } = useTranslation(['adminUsers', 'enums'])
  const format = useFormat()
  return (
    <Facts title={t('detail.learningTitle')} rows={[[t('columns.learning'), t('learning', learning)]]}>
      <List
        items={learning.items}
        empty={t('detail.noCourses')}
        render={(course) => (
          <li key={course.courseId} className={styles.item}>
            <span>{course.title}</span>
            <span className={styles.muted}>
              {[
                t('detail.enrolled', { date: format.date(course.enrolledAt) }),
                course.completedAt && t('detail.completed', { date: format.date(course.completedAt) }),
                course.certificate && `${t('detail.certificate', { code: course.certificate.code })} · ${t(`enums:certificateStatus.${course.certificate.status}`)}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </li>
        )}
      />
    </Facts>
  )
}

/** The plan facts of a candidate (Plus) or recruiter (Recruiter Plus, P11c-Q8): plan, subscription status, period, renewal. */
function PlanFacts({ plan }) {
  const { t } = useTranslation(['adminUsers', 'enums', 'adminPayments'])
  const format = useFormat()
  const subscription = plan.subscription
  return (
    <Facts
      title={t('detail.plan')}
      rows={[
        [t('columns.plan'), t(`enums:planKey.${plan.plan}`)],
        [t('adminPayments:details.subscription'), subscription ? t(`adminPayments:subscriptionStatus.${subscription.status}`) : t('detail.noSubscription')],
        [t('adminPayments:details.period'), subscription?.currentPeriodStart && `${format.date(subscription.currentPeriodStart)} – ${format.date(subscription.currentPeriodEnd)}`],
        [t('adminPayments:details.renewal'), subscription?.cancelAtPeriodEnd && t('detail.cancelAtPeriodEnd')],
      ]}
    />
  )
}

/** A candidate's sections: `part="main"` the growing ones (profile, verification, applications, learning), `part="side"` the short facts. */
function CandidateSections({ user, part }) {
  const { t } = useTranslation(['adminUsers', 'enums', 'adminPayments'])
  const format = useFormat()
  const { me } = usePreferences()
  const documents = can(me, 'documents.view')
  const yesNo = (value) => (value ? t('detail.yes') : t('detail.no'))
  const { profile, verification } = user
  if (part === 'side') {
    return (
      <>
        <PlanFacts plan={user.plan} />
        <Facts
          title={t('detail.privacy')}
          rows={[
            [t('detail.discoverable'), yesNo(user.privacy.discoverable)],
            [t('detail.resumeVisible'), yesNo(user.privacy.resumeVisible)],
            [t('detail.matchingConsent'), yesNo(user.privacy.matchingConsent)],
          ]}
        />
        <Facts title={t('detail.rightToWork')}>
          <List
            items={user.rightToWork}
            empty={t('noRightToWork')}
            render={(entry) => (
              <li key={entry.region} className={styles.item}>
                {t(`enums:rtwRegion.${entry.region}`)} · {t(`enums:rtwStatus.${entry.status}`)}
              </li>
            )}
          />
        </Facts>
      </>
    )
  }
  return (
    <>
      <Facts
        title={t('detail.profile')}
        rows={
          profile && [
            [t('detail.headline'), profile.headline],
            [t('detail.location'), profile.location && `${profile.location.city}, ${format.country(profile.location.countryCode)}`],
            [t('detail.years'), profile.yearsExperience !== null && format.number(profile.yearsExperience)],
            [t('detail.skills'), format.list(profile.skills)],
            [t('detail.workPreference'), profile.workPreference && t(`enums:workPreference.${profile.workPreference}`)],
            [t('detail.availability'), profile.availability && t(`enums:availability.${profile.availability}`)],
            [t('detail.completeness'), t('detail.completenessValue', profile.completeness)],
          ]
        }
      >
        {!profile && <p className={styles.muted}>{t('detail.noProfile')}</p>}
        {profile?.restricted && <p className={styles.warning}>{t('detail.restricted', { reason: profile.restricted.reason })}</p>}
      </Facts>
      <Facts
        title={t('detail.verification')}
        badge={<PillBadge tone={VERIFICATION_TONES[verification.state]}>{t(`verificationState.${verification.state}`, { count: verification.count })}</PillBadge>}
      >
        {!documents && verification.submissions.some((submission) => submission.fileId) && <p className={styles.muted}>{t('detail.documentsLocked')}</p>}
        {/* One aligned row per submission: icon · what + when · file · status. */}
        <List
          items={verification.submissions}
          empty={t('detail.noSubmissions')}
          render={(submission) => (
            <li key={submission.id} className={styles.submission} data-submission={submission.category}>
              <span className={styles.submissionIcon}>
                <Icon as={CATEGORY_ICONS[submission.category] ?? ShieldCheck} size={16} />
              </span>
              <div className={styles.submissionText}>
                <p className={styles.submissionTitle}>
                  {[t(`enums:verificationCategory.${submission.category}`), submission.evidenceType && t(`enums:evidenceType.${submission.evidenceType}`)].filter(Boolean).join(' · ')}
                </p>
                <p className={styles.muted}>
                  {[
                    t('detail.submitted', { date: format.date(submission.submittedAt) }),
                    submission.reviewedAt && t('detail.reviewed', { date: format.date(submission.reviewedAt) }),
                    submission.reason && t('detail.reason', { reason: submission.reason }),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <div className={styles.submissionFile}>
                {submission.fileId ? documents && <FileLink fileId={submission.fileId} name={submission.fileName} /> : <span className={styles.muted}>{t('detail.fileRemoved')}</span>}
              </div>
              <PillBadge tone={SUBMISSION_TONES[submission.status]}>{t(`enums:verificationStatus.${submission.status}`)}</PillBadge>
            </li>
          )}
        />
      </Facts>
      <Facts title={t('detail.applications')}>
        <List
          items={user.applications}
          empty={t('detail.noApplications')}
          render={(application) => (
            <li key={application.id} className={styles.item}>
              <span>
                {application.job.title} · {application.company}
              </span>
              <span className={styles.muted}>
                {t(`enums:applicationStatus.${application.status}`)} · {t('detail.applied', { date: format.date(application.appliedAt) })}
              </span>
            </li>
          )}
        />
      </Facts>
      <Learning learning={user.learning} />
    </>
  )
}

/** A recruiter's sections: `part="main"` company, KYC files, review history, learning; `part="side"` the plan and the job counts. */
function RecruiterSections({ user, part }) {
  const { t } = useTranslation(['adminUsers', 'enums'])
  const format = useFormat()
  const { me } = usePreferences()
  const { company } = user
  if (part === 'side') {
    return (
      <>
        <PlanFacts plan={user.plan} />
        <Facts
          title={t('detail.jobs')}
          rows={[
            [t('detail.jobs'), t('detail.jobsCounts', user.jobs)],
            [t('detail.received'), t('detail.receivedCount', user.applications)],
          ]}
        />
      </>
    )
  }
  return (
    <>
      <Facts
        title={t('detail.company')}
        rows={
          company && [
            [t('detail.legalName'), company.legalName],
            [t('detail.displayName'), company.displayName],
            [t('detail.industry'), company.industry],
            [t('detail.size'), company.size && t(`enums:companySize.${company.size}`)],
            [t('detail.location'), company.location && `${company.location.city}, ${format.country(company.location.countryCode)}`],
            [t('detail.website'), company.website],
            [t('detail.businessEmail'), company.businessEmail],
            [t('detail.businessAddress'), company.businessAddress],
            [t('detail.registration'), company.registrationDetails],
          ]
        }
      >
        {!company && <p className={styles.muted}>{t('detail.noCompany')}</p>}
      </Facts>
      <Facts title={t('detail.documents')}>
        {!can(me, 'documents.view') && user.documents.length > 0 && <p className={styles.muted}>{t('detail.documentsLocked')}</p>}
        <List
          items={user.documents}
          empty={t('detail.noDocuments')}
          render={(document) => (
            <li key={document.id} className={styles.item}>
              <span>{t(`enums:kycDocType.${document.type}`)}</span>
              {document.fileId ? can(me, 'documents.view') && <FileLink fileId={document.fileId} name={document.name} /> : <span className={styles.muted}>{t('detail.fileRemoved')}</span>}
            </li>
          )}
        />
      </Facts>
      <Facts title={t('detail.reviewHistory')}>
        <List
          items={user.reviewHistory}
          empty={t('detail.noReviews')}
          render={(entry, index) => (
            <li key={index} className={styles.item}>
              <span>
                {t(entry.by ? 'detail.decisionBy' : 'detail.decisionSystem', { decision: t(`enums:accountDecision.${entry.decision}`), name: entry.by, date: format.dateTime(entry.at) })}
              </span>
              {entry.reason && <span className={styles.muted}>{t('detail.reason', { reason: entry.reason })}</span>}
            </li>
          )}
        />
      </Facts>
      <Learning learning={user.learning} />
    </>
  )
}

/* Value widths (px) of placeholder fact rows. */
const SKELETON_VALUES = [140, 96, 180, 120, 160]

/** Placeholder fact rows: the real `labels` when given, else label bones. */
function FactsSkeleton({ labels }) {
  return (
    <div className={styles.facts}>
      {(labels ?? SKELETON_VALUES).map((label, index) => (
        <div key={index} className={styles.fact}>
          <span className={styles.skeletonLabel}>{labels ? label : <Skeleton width={88} />}</span>
          <span>
            <Skeleton width={SKELETON_VALUES[index % SKELETON_VALUES.length]} />
          </span>
        </div>
      ))}
    </div>
  )
}

/** The page while the user loads: the header (photo, name, status, contact; a candidate's stats) and both columns. */
function UserSkeleton({ candidate }) {
  const { t } = useTranslation('adminUsers')
  return (
    <SkeletonRegion>
      <Panel className={styles.hero} padding={24}>
        <Skeleton shape="circle" width={72} height={72} />
        <div className={styles.heroText}>
          <div className={styles.heroName}>
            <span className={styles.name}>
              <Skeleton width={220} height={24} />
            </span>
            <Skeleton shape="pill" />
          </div>
          <p className={styles.subtitle}>
            <Skeleton width={260} height={12} />
          </p>
          <p className={styles.meta}>
            <Skeleton width={240} />
          </p>
        </div>
        {candidate && (
          <div className={styles.stats}>
            {[t('detail.completeness'), t('columns.plan'), t('columns.verification')].map((label) => (
              <div key={label} className={styles.stat}>
                <p className={styles.skeletonStatLabel}>{label}</p>
                <p className={styles.skeletonStatValue}>
                  <Skeleton width={56} height={14} />
                </p>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <div className={styles.layout}>
        <div className={styles.column}>
          {[0, 1].map((index) => (
            <Panel key={index} className={styles.section}>
              <div className={styles.headingRow}>
                <Skeleton width={120} height={16} />
              </div>
              <FactsSkeleton />
            </Panel>
          ))}
        </div>
        <div className={styles.column}>
          <Panel className={styles.section}>
            <div className={styles.headingRow}>
              <h2 className={styles.heading}>{t('detail.account')}</h2>
            </div>
            <FactsSkeleton labels={[t('detail.emailVerified'), t('detail.phone'), t('detail.language'), t('detail.joined'), t('detail.lastLogin')]} />
          </Panel>
        </div>
      </div>
    </SkeletonRegion>
  )
}

/**
 * /admin/candidates/:userId and /admin/recruiters/:userId (M-161): account, then the role's sections (profile,
 * verification, plan, applications, learning; or company, KYC files, review history, jobs), then the audit history.
 * Files open only with `documents.view`.
 */
export default function UserDetailPage({ role }) {
  const { t } = useTranslation(['adminUsers', 'enums'])
  const format = useFormat()
  const { userId } = useParams()
  const { data: user, error, isLoading } = useGetAdminUserQuery(userId)
  const listPath = workspacePath(WORKSPACES.admin, `${role}s`)
  const back = (
    <Link to={listPath} className={styles.back}>
      <Icon as={ArrowLeft} size={14} />
      {t('detail.back', { list: t(`caption.${role}`) })}
    </Link>
  )
  if (errorCode(error) === 'NOT_FOUND' || (user && user.role !== role)) {
    return (
      <>
        {back}
        <EmptyState icon={UserX} title={t('detail.notFound')} />
      </>
    )
  }
  if (isLoading)
    return (
      <>
        {back}
        <UserSkeleton candidate={role === 'candidate'} />
      </>
    )
  if (!user) return back

  const phone = user.phone.e164 && t(user.phone.verified ? 'detail.phoneVerified' : 'detail.phoneUnverified', { phone: user.phone.e164 })
  const candidate = role === 'candidate'
  const { profile, company } = user
  const subtitle = candidate
    ? [profile?.headline, profile?.location && `${profile.location.city}, ${format.country(profile.location.countryCode)}`]
    : [user.jobTitle, company?.displayName]
  const stats = candidate && [
    [t('detail.completeness'), profile ? format.number(profile.completeness.percent / 100, { style: 'percent' }) : '—'],
    [t('columns.plan'), t(`enums:planKey.${user.plan.plan}`)],
    [t('columns.verification'), t(`verificationState.${user.verification.state}`, { count: user.verification.count })],
  ]
  return (
    <>
      {back}
      <Panel className={styles.hero} padding={24}>
        <Avatar name={user.fullName} src={(candidate ? profile?.photoUrl : company?.logoUrl) ?? undefined} size={72} />
        <div className={styles.heroText}>
          <div className={styles.heroName}>
            <h1 className={styles.name}>{user.fullName}</h1>
            <PillBadge tone={candidate ? (STATUS_TONES[user.status] ?? 'neutral') : STATE_TONES[user.state]} dot>
              {candidate ? t(`enums:userStatus.${user.status}`) : t(`recruiterState.${user.state}`)}
            </PillBadge>
          </div>
          {subtitle.some(Boolean) && <p className={styles.subtitle}>{subtitle.filter(Boolean).join(' · ')}</p>}
          <p className={styles.meta}>
            {user.email} · {t('detail.joined')} {format.date(user.joinedAt)}
          </p>
        </div>
        {stats && (
          <dl className={styles.stats}>
            {stats.map(([label, value]) => (
              <div key={label} className={styles.stat}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </Panel>
      {/* Two independent columns (LinkedIn-style): each stacks its own cards, so a long section never leaves a gap beside a short one. */}
      <div className={styles.layout}>
        <div className={`${styles.column} sticky-side`}>
          {candidate ? <CandidateSections user={user} part="main" /> : <RecruiterSections user={user} part="main" />}
          <History events={user.history} />
        </div>
        <aside className={`${styles.column} sticky-side`}>
          <Facts
            title={t('detail.account')}
            rows={[
              [t('detail.emailVerified'), user.emailVerified ? t('detail.yes') : t('detail.no')],
              [t('detail.phone'), phone || t('detail.none')],
              [t('detail.jobTitle'), user.jobTitle],
              [t('detail.language'), format.languageName(user.language)],
              [t('detail.joined'), format.date(user.joinedAt)],
              [t('detail.lastLogin'), user.lastLoginAt ? format.dateTime(user.lastLoginAt) : t('detail.never')],
            ]}
          />
          {candidate ? <CandidateSections user={user} part="side" /> : <RecruiterSections user={user} part="side" />}
        </aside>
      </div>
    </>
  )
}
