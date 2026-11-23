import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { Settings2, Users } from 'lucide-react'
import { hiringPath } from '@/app/roles.js'
import ConfirmDialog from '@/components/common/ConfirmDialog.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import FilterChips from '@/components/common/FilterChips.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { Avatar, Button, Dropdown, IconButton, SelectField, Skeleton, SkeletonRegion } from '@/components/ui'
import { useGetRecruiterJobsQuery } from '@/features/recruiter/jobs/api.js'
import { useErrorText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { useGetAgreementQuery, useGetTalentQuery, useTalentActionMutation } from '../../api.js'
import AgreementPanel from '../components/AgreementPanel.jsx'
import BooksRanking from '../components/BooksRanking.jsx'
import styles from './TalentPage.module.css'

const TABS = ['books', 'requests', 'agreement']
const IN_TAB = { books: ['active'], requests: ['requested', 'awaiting_agreement'] }

function RowsSkeleton() {
  return (
    <SkeletonRegion className={styles.card}>
      {[0, 1, 2].map((key) => (
        <div key={key} className={styles.row}>
          <Skeleton shape="circle" width={40} height={40} />
          <div className={styles.text}>
            <Skeleton width={150} height={14} />
            <Skeleton width={210} height={12} />
          </div>
        </div>
      ))}
    </SkeletonRegion>
  )
}

/** One candidate row: who, where, the agreement state and the actions of this tab. */
function TalentRow({ member, onAction, busy }) {
  const { t } = useTranslation()
  const format = useFormat()
  const { candidate } = member
  const place = candidate.location && t('common:city.value', { city: candidate.location.city, country: format.country(candidate.location.countryCode) })
  const profile = hiringPath(`find-candidates/${candidate.id}`)
  return (
    <li className={styles.row} data-member={candidate.name}>
      <Avatar name={candidate.name ?? ''} size={40} />
      <Link to={profile} className={styles.text}>
        <span className={styles.name}>{candidate.name ?? t('common:deletedUser')}</span>
        <span className={styles.meta}>{[candidate.headline, place].filter(Boolean).join(' · ') || t('agency:talent.noDetails')}</span>
      </Link>
      {member.status === 'active' &&
        (member.needsAgreement ? (
          <PillBadge tone="warning">{t('agency:talent.newVersionWaiting')}</PillBadge>
        ) : (
          <PillBadge tone="success">{t('agency:talent.agreed', { version: member.acceptedVersion })}</PillBadge>
        ))}
      {member.status === 'requested' && (
        <div className={styles.actions}>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction(member, 'decline')}>
            {t('agency:talent.decline')}
          </Button>
          <Button size="sm" loading={busy} onClick={() => onAction(member, 'accept')}>
            {t('agency:talent.accept')}
          </Button>
        </div>
      )}
      {member.status === 'awaiting_agreement' && (
        <>
          <PillBadge tone="info">{t(member.requestedBy === 'agency' ? 'agency:talent.invited' : 'agency:talent.waitingAgreement')}</PillBadge>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => onAction(member, 'decline')}>
            {t('agency:talent.withdraw')}
          </Button>
        </>
      )}
      {member.status === 'active' && (
        <Dropdown panelClassName={styles.menuPanel} trigger={(props) => <IconButton icon={Settings2} label={t('agency:talent.manage', { name: candidate.name })} {...props} />}>
          {({ close }) => (
            <div className={styles.menu}>
              <Link to={profile} className={styles.menuItem} onClick={close}>
                {t('agency:talent.viewProfile')}
              </Link>
              <button
                type="button"
                className={`${styles.menuItem} ${styles.menuDanger}`}
                onClick={() => {
                  close()
                  onAction(member, 'end')
                }}
              >
                {t('agency:talent.remove')}
              </button>
            </div>
          )}
        </Dropdown>
      )}
    </li>
  )
}

/** 2026-11-20: Agency › Talent: the candidates on the books, requests and invitations, and the agreement. */
export default function TalentPage() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const [params, setParams] = useSearchParams()
  const tab = TABS.includes(params.get('tab')) ? params.get('tab') : 'books'
  const { data, isLoading } = useGetTalentQuery()
  const { data: agreement } = useGetAgreementQuery()
  const [act] = useTalentActionMutation()
  const [busyId, setBusyId] = useState(null)
  const [failure, setFailure] = useState(null)
  const [ending, setEnding] = useState(null)
  // Phase 6: On the books can rank everyone for one of the agency's open agency jobs (?jobId).
  const { data: jobs } = useGetRecruiterJobsQuery(undefined, { skip: tab !== 'books' })
  const rankable = (jobs?.items ?? []).filter((job) => job.agency && job.status !== 'closed')
  const rankFor = tab === 'books' && rankable.some((job) => job.id === params.get('jobId')) ? params.get('jobId') : ''
  const members = data?.items ?? []
  const inTab = (id) => members.filter((member) => IN_TAB[id]?.includes(member.status))
  const noAgreement = agreement && !agreement.current

  async function run(member, action) {
    if (action === 'end' && ending?.id !== member.id) return setEnding(member)
    setBusyId(member.id)
    setFailure(null)
    try {
      await act({ id: member.id, action }).unwrap()
      setEnding(null)
    } catch (error) {
      setFailure(error)
    } finally {
      setBusyId(null)
    }
  }

  const visible = tab === 'agreement' ? [] : inTab(tab)
  return (
    <>
      <PageTitle title={t('agency:talent.title')} description={t('agency:talent.description')} />
      <div data-tour="talent-tabs">
        <FilterChips
          className={styles.tabs}
          label={t('agency:talent.tabsLabel')}
          options={TABS.map((id) => ({ id, label: t(`agency:talent.tabs.${id}`), count: id === 'agreement' || !data ? undefined : inTab(id).length }))}
          value={tab}
          onChange={(id) => setParams(id === 'books' ? {} : { tab: id }, { replace: true })}
        />
      </div>

      {tab === 'agreement' ? (
        <AgreementPanel />
      ) : (
        <>
          {noAgreement && (
            <div className={styles.banner} data-no-agreement>
              <p>{t('agency:talent.noAgreement')}</p>
              <Button size="sm" variant="outline" onClick={() => setParams({ tab: 'agreement' }, { replace: true })}>
                {t('agency:talent.openAgreement')}
              </Button>
            </div>
          )}
          {failure && (
            <p className={styles.failure} role="alert">
              {errorText.code(failure)}
            </p>
          )}
          {tab === 'books' && rankable.length > 0 && inTab('books').length > 0 && (
            <div className={styles.rankFor}>
              <SelectField
                label={t('agency:ranking.rankFor')}
                name="rankFor"
                options={[{ value: '', label: t('agency:ranking.everyone') }, ...rankable.map((job) => ({ value: job.id, label: job.title }))]}
                value={rankFor}
                onChange={(event) => setParams(event.target.value ? { jobId: event.target.value } : {}, { replace: true })}
              />
            </div>
          )}
          {rankFor ? (
            <BooksRanking key={rankFor} jobId={rankFor} />
          ) : isLoading ? (
            <RowsSkeleton />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={Users}
              title={t(`agency:talent.empty.${tab}.title`)}
              description={t(`agency:talent.empty.${tab}.text`)}
              action={
                <Button as={Link} to={hiringPath('find-candidates')} variant="outline">
                  {t('agency:talent.findCandidates')}
                </Button>
              }
            />
          ) : (
            <section className={styles.card} aria-label={t(`agency:talent.tabs.${tab}`)}>
              <ul className={styles.list}>
                {visible.map((member) => (
                  <TalentRow key={member.id} member={member} onAction={run} busy={busyId === member.id} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <ConfirmDialog
        open={Boolean(ending)}
        title={t('agency:talent.removeTitle', { name: ending?.candidate.name })}
        description={t('agency:talent.removeText')}
        confirmLabel={t('agency:talent.remove')}
        tone="danger"
        onConfirm={() => run(ending, 'end')}
        onClose={() => setEnding(null)}
      />
    </>
  )
}
