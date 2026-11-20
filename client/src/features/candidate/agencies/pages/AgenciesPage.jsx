import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import { errorCode } from '@/app/api.js'
import ConfirmDialog from '@/components/common/ConfirmDialog.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import FilterChips from '@/components/common/FilterChips.jsx'
import NoticeBanner from '@/components/common/NoticeBanner.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { Button, CompanyLogo, Modal, Skeleton, SkeletonRegion } from '@/components/ui'
import { RulesList } from '@/features/agency/components/ContractRules.jsx'
import { useRuleText } from '@/features/agency/rules.js'
import { useErrorText } from '@/lib/forms.js'
import { useJobText } from '@/lib/jobText.js'
import { useFormat } from '@/lib/preferences.js'
import { useGetMyAgenciesQuery, useGetMyPlacementsQuery, useJoinAgencyMutation, useMembershipActionMutation, usePlacementActionMutation } from '../api.js'
import styles from './AgenciesPage.module.css'

/*
 * 2026-11-20 (agencies, phase 5): the candidate's Agencies page: placements (running, upcoming, over), re-hire offers
 * to accept or decline, and the agencies whose books they asked to join, were invited to or are on.
 */
const TABS = ['placements', 'offers', 'agencies']
const PHASES = ['running', 'upcoming', 'over']
const PHASE_TONE = { running: 'success', upcoming: 'info', over: 'neutral' }
const DAY_MS = 24 * 60 * 60 * 1000
const todayText = () => new Date().toISOString().slice(0, 10)
const addDays = (day, days) => new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)

/** "1 Dec 2026 to 31 Dec 2026", with the earlier real end when notice was given or the agency ended it early. */
function useDates() {
  const { t } = useTranslation()
  const format = useFormat()
  const jobText = useJobText()
  return (placement) => {
    const range = jobText.dates(placement)
    if (!placement.effectiveEnd || placement.effectiveEnd === placement.endDate) return range
    return `${range} · ${t(`agency:placements.${placement.noticeGivenOn ? 'notice' : 'endedEarly'}`, { date: format.date(placement.effectiveEnd) })}`
  }
}

/** The candidate-side text of an offer's failure: their own agreement or books, else the general error. */
function useOfferError() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  return (failure, placement) => {
    const reason = failure?.data?.error?.params?.reason
    if (errorCode(failure) === 'CONFLICT' && ['agreement_pending', 'not_on_books'].includes(reason)) return t(`agency:candidate.offer.${reason}`, { agency: placement.agency.displayName })
    return errorText.code(failure)
  }
}

/** One placement or offer: the agency, the job and client, dates and pay. */
function PlacementRow({ placement, onOpen, children }) {
  const { t } = useTranslation()
  const jobText = useJobText()
  const dates = useDates()
  return (
    <li className={styles.row} data-placement={placement.job.title}>
      <CompanyLogo name={placement.agency.displayName ?? ''} id={placement.agency.id} src={placement.agency.logoUrl ?? undefined} size={40} />
      <button type="button" className={styles.text} onClick={onOpen}>
        <span className={styles.name}>{placement.job.title}</span>
        <span className={styles.meta}>{[t('agency:candidate.through', { agency: placement.agency.displayName }), placement.client && t('agency:candidate.forClient', { client: placement.client.name })].filter(Boolean).join(' · ')}</span>
        <span className={styles.meta}>{[dates(placement), jobText.rate(placement)].filter(Boolean).join(' · ')}</span>
      </button>
      {children}
    </li>
  )
}

/** A placement in full, with its rules (an offer: the rules accepting it would bring) and the offer's answers. */
function PlacementDetails({ placement, onClose, onAnswered }) {
  const { t } = useTranslation()
  const format = useFormat()
  const jobText = useJobText()
  const dates = useDates()
  const offerError = useOfferError()
  const [act, { isLoading, originalArgs }] = usePlacementActionMutation()
  const [failure, setFailure] = useState(null)
  const offered = placement.status === 'offered'
  async function answer(action) {
    try {
      await act({ id: placement.id, action }).unwrap()
      onAnswered(action)
    } catch (error) {
      setFailure(error)
    }
  }
  const facts = [
    ['client', placement.client?.name ?? t('agency:candidate.confidentialClient')],
    ['dates', dates(placement)],
    ['hours', t('agency:rules.hours', { count: placement.hoursPerWeek })],
    ['pay', jobText.rate(placement)],
  ].filter(([, value]) => value)
  return (
    <Modal
      open
      placement="right"
      width={560}
      title={placement.job.title}
      description={t('agency:candidate.through', { agency: placement.agency.displayName })}
      onClose={onClose}
      footer={
        offered ? (
          <>
            <Button variant="outline" loading={isLoading && originalArgs?.action === 'decline'} disabled={isLoading} onClick={() => answer('decline')}>
              {t('agency:candidate.offer.decline')}
            </Button>
            <Button loading={isLoading && originalArgs?.action === 'accept'} disabled={isLoading} onClick={() => answer('accept')} data-accept-offer>
              {t('agency:candidate.offer.accept')}
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            {t('agency:candidate.close')}
          </Button>
        )
      }
    >
      <dl className={styles.facts}>
        {facts.map(([key, value]) => (
          <div key={key}>
            <dt>{t(`agency:candidate.terms.${key}`)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {placement.noticeGivenOn && <p className={styles.note}>{t('agency:candidate.notice.given', { date: format.date(placement.noticeGivenOn) })}</p>}
      <h3 className={styles.rulesTitle}>{t(offered ? 'agency:candidate.rulesIfAccepted' : 'agency:candidate.rules')}</h3>
      <p className={styles.note}>{t('agency:candidate.rulesIntro')}</p>
      <RulesList rules={placement.rules} sources={placement.sources} />
      {failure && (
        <p className={styles.failure} role="alert">
          {offerError(failure, placement)}
        </p>
      )}
    </Modal>
  )
}

/** Notice from today: the placement ends after the notice period (never later than its end). */
function NoticeDialog({ placement, onClose }) {
  const { t } = useTranslation()
  const format = useFormat()
  const errorText = useErrorText()
  const ruleText = useRuleText()
  const [act, { isLoading }] = usePlacementActionMutation()
  const [failure, setFailure] = useState(null)
  const notice = placement.rules?.noticeDays
  const fromNotice = addDays(todayText(), notice?.value ?? 0)
  const lastDay = fromNotice < placement.effectiveEnd ? fromNotice : placement.effectiveEnd
  async function confirm() {
    try {
      await act({ id: placement.id, action: 'notice' }).unwrap()
      onClose()
    } catch (error) {
      setFailure(error)
    }
  }
  return (
    <Modal
      open
      title={t('agency:candidate.notice.title', { job: placement.job.title })}
      description={t('agency:candidate.notice.text')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common:cancel')}
          </Button>
          <Button variant="danger" loading={isLoading} onClick={confirm} data-confirm-notice>
            {t('agency:candidate.notice.confirm')}
          </Button>
        </>
      }
    >
      <div className={styles.dialogBody}>
        <p className={styles.dialogText}>{t('agency:candidate.notice.period', { period: ruleText('noticeDays', notice?.value) })}</p>
        {notice?.clause && <blockquote className={styles.clause}>“{notice.clause}”</blockquote>}
        <p className={styles.dialogStrong} data-notice-last-day>
          {t('agency:candidate.notice.endsOn', { date: format.date(lastDay) })}
        </p>
        {failure && (
          <p className={styles.failure} role="alert">
            {errorText.code(failure)}
          </p>
        )}
      </div>
    </Modal>
  )
}

function Placements({ placements, onOpen, onNotice }) {
  const { t } = useTranslation()
  const format = useFormat()
  if (placements.length === 0) return <EmptyState icon={Building2} title={t('agency:candidate.empty.placements.title')} description={t('agency:candidate.empty.placements.text')} />
  return PHASES.map((phase) => {
    const items = placements.filter((placement) => placement.phase === phase)
    if (items.length === 0) return null
    return (
      <section key={phase} className={styles.group} aria-labelledby={`phase-${phase}`}>
        <h2 id={`phase-${phase}`} className={styles.groupTitle}>
          {t(`agency:candidate.phases.${phase}`)} <span className={styles.groupCount}>{items.length}</span>
        </h2>
        <ul className={styles.card}>
          {items.map((placement) => (
            <PlacementRow key={placement.id} placement={placement} onOpen={() => onOpen(placement)}>
              <PillBadge tone={PHASE_TONE[phase]}>{t(`agency:candidate.phases.${phase}`)}</PillBadge>
              {placement.noticeGivenOn && <PillBadge tone="warning">{t('agency:candidate.notice.given', { date: format.date(placement.noticeGivenOn) })}</PillBadge>}
              {phase !== 'over' && !placement.noticeGivenOn && (
                <div className={styles.actions}>
                  <Button size="sm" variant="outline" onClick={() => onNotice(placement)} data-give-notice>
                    {t('agency:candidate.notice.action')}
                  </Button>
                </div>
              )}
            </PlacementRow>
          ))}
        </ul>
      </section>
    )
  })
}

function Offers({ offers, onOpen }) {
  const { t } = useTranslation()
  if (offers.length === 0) return <EmptyState icon={Building2} title={t('agency:candidate.empty.offers.title')} description={t('agency:candidate.empty.offers.text')} />
  return (
    <ul className={styles.card}>
      {offers.map((offer) => (
        <PlacementRow key={offer.id} placement={offer} onOpen={() => onOpen(offer)}>
          <div className={styles.actions}>
            <Button size="sm" onClick={() => onOpen(offer)} data-view-offer>
              {t('agency:candidate.offer.view')}
            </Button>
          </div>
        </PlacementRow>
      ))}
    </ul>
  )
}

/** The agencies: status, the agreement state and what the candidate can do next. */
function Agencies({ memberships, onLeave }) {
  const { t } = useTranslation()
  const format = useFormat()
  const errorText = useErrorText()
  const [act, { error: actError }] = useMembershipActionMutation()
  const [join, { error: joinError }] = useJoinAgencyMutation()
  const failure = actError ?? joinError
  if (memberships.length === 0) return <EmptyState icon={Building2} title={t('agency:candidate.empty.agencies.title')} description={t('agency:candidate.empty.agencies.text')} />
  const statusTone = { requested: 'info', awaiting_agreement: 'warning', active: 'success', declined: 'neutral', ended: 'neutral' }
  return (
    <>
      {failure && (
        <p className={styles.failure} role="alert">
          {errorText.code(failure)}
        </p>
      )}
      <ul className={styles.card}>
        {memberships.map((membership) => {
          const agreementPath = `/candidate/agencies/memberships/${membership.id}/agreement`
          const detail = membership.needsAgreement && membership.acceptedVersion
            ? t('agency:candidate.membership.newVersion', { version: membership.agreement.version })
            : membership.acceptedVersion
              ? t('agency:candidate.membership.agreed', { version: membership.acceptedVersion, date: format.date(membership.acceptedAt) })
              : membership.requestedBy === 'agency' && membership.status === 'awaiting_agreement'
                ? t('agency:candidate.membership.invited')
                : membership.agency.industry
          return (
            <li key={membership.id} className={styles.row} data-membership={membership.agency.displayName}>
              <CompanyLogo name={membership.agency.displayName} id={membership.agency.id} src={membership.agency.logoUrl ?? undefined} size={40} />
              <div className={styles.text}>
                <span className={styles.name}>{membership.agency.displayName}</span>
                {detail && <span className={styles.meta}>{detail}</span>}
              </div>
              <PillBadge tone={membership.needsAgreement ? 'warning' : statusTone[membership.status]}>{t(`agency:candidate.membership.status.${membership.needsAgreement ? 'awaiting_agreement' : membership.status}`)}</PillBadge>
              <div className={styles.actions}>
                {membership.status === 'requested' && (
                  <Button size="sm" variant="ghost" onClick={() => act({ id: membership.id, action: 'decline' })}>
                    {t('agency:candidate.membership.withdraw')}
                  </Button>
                )}
                {membership.status === 'awaiting_agreement' && (
                  <Button size="sm" variant="ghost" onClick={() => act({ id: membership.id, action: 'decline' })}>
                    {t('agency:candidate.membership.decline')}
                  </Button>
                )}
                {membership.needsAgreement && (
                  <Button size="sm" as={Link} to={agreementPath} data-read-agreement>
                    {membership.acceptedVersion ? t('agency:candidate.membership.readNew', { version: membership.agreement.version }) : t('agency:candidate.membership.read')}
                  </Button>
                )}
                {membership.status === 'active' && (
                  <Button size="sm" variant="outline" onClick={() => onLeave(membership)}>
                    {t('agency:candidate.membership.leave')}
                  </Button>
                )}
                {['declined', 'ended'].includes(membership.status) && (
                  <Button size="sm" variant="outline" onClick={() => join(membership.agency.id)}>
                    {t('agency:candidate.membership.join')}
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}

export default function AgenciesPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const tab = TABS.includes(params.get('tab')) ? params.get('tab') : 'placements'
  const { data: placementData } = useGetMyPlacementsQuery()
  const { data: agencyData } = useGetMyAgenciesQuery()
  const [membershipAction] = useMembershipActionMutation()
  const [open, setOpen] = useState(null)
  const [noticeFor, setNoticeFor] = useState(null)
  const [leaving, setLeaving] = useState(null)
  // Back from the agreement page after agreeing: "You are on <agency>'s books."
  const { state } = useLocation()
  const [notice, setNotice] = useState(() => (state?.agreed ? t('agency:candidate.agreement.agreed', { agency: state.agreed }) : null))
  const loaded = Boolean(placementData && agencyData)
  const placements = (placementData?.items ?? []).filter((placement) => placement.status === 'confirmed')
  const offers = (placementData?.items ?? []).filter((placement) => placement.status === 'offered')
  const memberships = agencyData?.items ?? []
  const counts = { placements: placements.length, offers: offers.length, agencies: memberships.length }

  function answered(placement, action) {
    setOpen(null)
    if (action === 'accept') setNotice(t('agency:candidate.offer.accepted', { job: placement.job.title }))
  }

  return (
    <>
      <PageTitle title={t('agency:candidate.title')} description={t('agency:candidate.description')} />
      {loaded && placements.length + offers.length + memberships.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t('agency:candidate.start.title')}
          description={t('agency:candidate.start.text')}
          action={
            <Button as={Link} to="/candidate/jobs?employmentType=agency">
              {t('agency:candidate.start.action')}
            </Button>
          }
        />
      ) : (
        <>
          <FilterChips
            className={styles.tabs}
            label={t('agency:candidate.tabsLabel')}
            options={TABS.map((id) => ({ id, label: t(`agency:candidate.tabs.${id}`), count: loaded ? counts[id] : undefined }))}
            value={tab}
            onChange={(id) => setParams(id === 'placements' ? {} : { tab: id }, { replace: true })}
          />
          {notice && <NoticeBanner>{notice}</NoticeBanner>}
          {!loaded ? (
            <SkeletonRegion className={styles.card}>
              {[0, 1, 2].map((key) => (
                <div key={key} className={styles.row}>
                  <Skeleton shape="block" width={40} height={40} />
                  <div className={styles.text}>
                    <Skeleton width={160} height={14} />
                    <Skeleton width={240} height={12} />
                  </div>
                </div>
              ))}
            </SkeletonRegion>
          ) : tab === 'placements' ? (
            <Placements placements={placements} onOpen={setOpen} onNotice={setNoticeFor} />
          ) : tab === 'offers' ? (
            <Offers offers={offers} onOpen={setOpen} />
          ) : (
            <Agencies memberships={memberships} onLeave={setLeaving} />
          )}
        </>
      )}
      {open && <PlacementDetails placement={open} onClose={() => setOpen(null)} onAnswered={(action) => answered(open, action)} />}
      {noticeFor && <NoticeDialog placement={noticeFor} onClose={() => setNoticeFor(null)} />}
      <ConfirmDialog
        open={Boolean(leaving)}
        title={leaving ? t('agency:candidate.membership.leaveTitle', { agency: leaving.agency.displayName }) : ''}
        description={t('agency:candidate.membership.leaveText')}
        confirmLabel={t('agency:candidate.membership.leave')}
        tone="danger"
        onClose={() => setLeaving(null)}
        onConfirm={() => {
          membershipAction({ id: leaving.id, action: 'end' })
          setLeaving(null)
        }}
      />
    </>
  )
}
