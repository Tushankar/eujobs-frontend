import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { Laptop, LogOut, ShieldAlert, Smartphone, Tablet } from 'lucide-react'
import { Button, Icon, Panel, Skeleton, SkeletonRegion } from '@/components/ui'
import ConfirmDialog from '@/components/common/ConfirmDialog.jsx'
import FilterChips from '@/components/common/FilterChips.jsx'
import NoticeBanner from '@/components/common/NoticeBanner.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { useGetSessionsQuery, useRevokeSessionMutation, useSignOutOtherSessionsMutation } from '../api.js'
import styles from './DeviceSessions.module.css'

const DEVICE_ICON = { desktop: Laptop, mobile: Smartphone, tablet: Tablet }
const STATUS_TONE = { active: 'success', signed_out: 'neutral', expired: 'neutral', failed: 'danger' }
const PAGE = 8
// The server marks a session seen at most once a minute.
const ACTIVE_NOW_MS = 2 * 60 * 1000
const activeNow = (row) => row.current || Date.now() - new Date(row.lastSeenAt) < ACTIVE_NOW_MS

/**
 * Settings › Where you're signed in (owner 2026-11-18, every role): the active devices with Sign out, "Sign out of all
 * other devices", then the last 90 days of sign-ins and failed attempts with underline tabs.
 */
export default function DeviceSessions() {
  const { t } = useTranslation()
  const format = useFormat()
  const { hash } = useLocation()
  const cardRef = useRef(null)
  const { data, isLoading } = useGetSessionsQuery()
  const [revoke] = useRevokeSessionMutation()
  const [signOutOthers, { isLoading: signingOut }] = useSignOutOtherSessionsMutation()
  const [revoking, setRevoking] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [notice, setNotice] = useState(null)
  const [filter, setFilter] = useState('all')
  const [shown, setShown] = useState(PAGE)

  // The new-device email links to #devices.
  useEffect(() => {
    if (data && hash === '#devices') cardRef.current?.scrollIntoView({ block: 'start' })
  }, [data, hash])

  const device = (row) =>
    row.browser || row.os
      ? t('account:devices.device', { browser: row.browser ?? t('account:devices.unknownBrowser'), os: row.os ?? t('account:devices.unknownOs') })
      : t('account:devices.unknownDevice')
  const place = (row) => [row.city, row.country && format.country(row.country)].filter(Boolean).join(', ') || t('account:devices.unknownLocation')
  const where = (row) => [place(row), row.ip].filter(Boolean).join(' · ')

  async function handleRevoke(row) {
    setRevoking(row.id)
    setNotice(null)
    try {
      await revoke(row.id).unwrap()
      setNotice(t('account:devices.signedOutOne', { device: device(row) }))
    } finally {
      setRevoking(null)
    }
  }

  async function handleSignOutOthers() {
    setConfirming(false)
    const count = others.length
    await signOutOthers().unwrap()
    setNotice(t('account:devices.signedOutOthers', { count }))
  }

  const devices = data?.devices ?? []
  const others = devices.filter((row) => !row.current)
  // Owner 2026-11-19: signed-out sessions are not listed (still kept for the data export).
  const history = (data?.history ?? []).filter((row) => row.status !== 'signed_out')
  const failed = history.filter((row) => row.status === 'failed')
  const rows = filter === 'all' ? history : filter === 'failed' ? failed : history.filter((row) => row.status !== 'failed')

  return (
    <Panel padding={0} className={styles.card} id="devices" ref={cardRef} data-card="devices">
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h2 className={styles.heading}>{t('account:devices.title')}</h2>
          <p className={styles.description}>{t('account:devices.description')}</p>
        </div>
        {others.length > 0 && (
          <Button variant="outline" size="sm" leftIcon={<Icon as={LogOut} size={14} />} loading={signingOut} onClick={() => setConfirming(true)} className={styles.headerAction}>
            {t('account:devices.signOutOthers')}
          </Button>
        )}
      </div>
      {notice && (
        <div className={styles.notice}>
          <NoticeBanner>{notice}</NoticeBanner>
        </div>
      )}

      {isLoading ? (
        <SkeletonRegion className={styles.skeleton}>
          {[0, 1].map((index) => (
            <div key={index} className={styles.skeletonRow}>
              <Skeleton shape="circle" width={22} height={22} />
              <div className={styles.skeletonText}>
                <Skeleton width="40%" />
                <Skeleton width="65%" />
              </div>
            </div>
          ))}
        </SkeletonRegion>
      ) : (
        <>
          <ul className={styles.list} aria-label={t('account:devices.activeLabel')}>
            {devices.map((row) => {
              const live = activeNow(row)
              return (
                <li key={row.id} className={styles.row} data-session={row.current ? 'current' : 'other'}>
                  <Icon as={DEVICE_ICON[row.deviceType] ?? Laptop} size={22} className={styles.deviceIcon} />
                  <div className={styles.text}>
                    <p className={styles.title}>
                      {device(row)}
                      {row.current && (
                        <PillBadge tone="success" dot>
                          {t('account:devices.thisDevice')}
                        </PillBadge>
                      )}
                    </p>
                    <p className={styles.meta}>{where(row)}</p>
                    <p className={styles.meta}>
                      {t('account:devices.signedIn', { time: format.dateTime(row.signedInAt) })}
                      {' · '}
                      <span className={cx(live && styles.live)}>
                        {live ? t('account:devices.activeNow') : t('account:devices.lastActive', { time: format.relative(row.lastSeenAt) })}
                      </span>
                    </p>
                  </div>
                  {!row.current && (
                    <Button variant="outline" size="sm" loading={revoking === row.id} onClick={() => handleRevoke(row)} className={styles.rowAction}>
                      {t('account:devices.signOut')}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>

          <div className={styles.activityHead}>
            <h3 className={styles.subheading}>{t('account:devices.activityTitle')}</h3>
            <FilterChips
              label={t('account:devices.activityTitle')}
              value={filter}
              onChange={(value) => {
                setFilter(value)
                setShown(PAGE)
              }}
              options={[
                { id: 'all', label: t('account:devices.filters.all'), count: history.length },
                { id: 'success', label: t('account:devices.filters.success'), count: history.length - failed.length },
                { id: 'failed', label: t('account:devices.filters.failed'), count: failed.length },
              ]}
            />
          </div>
          {rows.length === 0 ? (
            <p className={styles.empty}>{t(filter === 'failed' ? 'account:devices.noFailed' : 'account:devices.noActivity')}</p>
          ) : (
            <ul className={styles.list} aria-label={t('account:devices.activityTitle')}>
              {rows.slice(0, shown).map((row) => (
                <li key={row.id} className={styles.row} data-status={row.status}>
                  <Icon
                    as={row.status === 'failed' ? ShieldAlert : (DEVICE_ICON[row.deviceType] ?? Laptop)}
                    size={20}
                    className={cx(styles.deviceIcon, row.status === 'failed' && styles.failedIcon)}
                  />
                  <div className={styles.text}>
                    <p className={styles.title}>{device(row)}</p>
                    <p className={styles.meta}>{where(row)}</p>
                  </div>
                  <div className={styles.when}>
                    <time dateTime={row.signedInAt} className={styles.time}>
                      {format.dateTime(row.signedInAt)}
                    </time>
                    <PillBadge tone={STATUS_TONE[row.status]} dot={row.status === 'active'}>
                      {row.current ? t('account:devices.thisDevice') : t(`account:devices.status.${row.status}`)}
                    </PillBadge>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {rows.length > shown && (
            <div className={styles.footer}>
              <Button variant="ghost" size="sm" onClick={() => setShown(shown + PAGE)}>
                {t('account:devices.showMore', { count: Math.min(PAGE, rows.length - shown) })}
              </Button>
            </div>
          )}
          <p className={styles.retention}>{t('account:devices.retention')}</p>
        </>
      )}

      <ConfirmDialog
        open={confirming}
        tone="danger"
        title={t('account:devices.confirmTitle')}
        description={t('account:devices.confirmText', { count: others.length })}
        confirmLabel={t('account:devices.signOutOthers')}
        onConfirm={handleSignOutOthers}
        onClose={() => setConfirming(false)}
      />
    </Panel>
  )
}
