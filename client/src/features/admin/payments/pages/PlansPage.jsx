import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Eye } from 'lucide-react'
import { can } from '@/app/permissions.js'
import NoticeBanner from '@/components/common/NoticeBanner.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { Button, Icon, Panel, Skeleton, SkeletonRegion } from '@/components/ui'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import { useGetAdminPaymentsQuery, useGetAdminPlansQuery } from '../api.js'
import PaymentsTabs from '../components/PaymentsTabs.jsx'
import PlanEditor from '../components/PlanEditor.jsx'
import styles from './PlansPage.module.css'

const ROLES = ['candidate', 'recruiter']
// The plan cards quote one currency; the editor shows them all.
const REFERENCE_CURRENCY = 'EUR'

/** One plan: its reference prices, yearly offer, subscribers and the editor button. */
function PlanSummary({ plan, manage, onOpen }) {
  const { t } = useTranslation('adminPayments')
  const format = useFormat()
  const row = plan.prices.find((entry) => entry.currency === REFERENCE_CURRENCY) ?? plan.prices[0]
  const { month, year, olderPrice } = plan.subscribers
  return (
    <Panel padding={24} className={styles.plan} data-admin-plan={plan.key}>
      <div className={styles.planHead}>
        <h3 className={styles.planName}>{plan.name.en}</h3>
        <Button variant="outline" size="sm" leftIcon={<Icon as={manage ? Pencil : Eye} size={13} />} onClick={onOpen}>
          {t(manage ? 'plans.edit' : 'plans.view')}
        </Button>
      </div>
      {plan.paid ? (
        <>
          <p className={styles.prices}>
            <strong>{t('plans.monthly', { price: format.money(row.monthlyMinor, row.currency) })}</strong>
            {plan.yearlyEnabled && <span>{t('plans.yearly', { price: format.money(row.yearlyMinor, row.currency) })}</span>}
          </p>
          <p className={styles.meta}>
            {plan.yearlyEnabled ? (
              <PillBadge tone="success">{t('plans.discount', { percent: plan.yearlyDiscountPercent })}</PillBadge>
            ) : (
              <PillBadge tone="neutral">{t('plans.yearlyOff')}</PillBadge>
            )}
            <span>{t('plans.currencies', { count: plan.prices.length })}</span>
          </p>
          <p className={styles.subscribers}>
            {t('plans.subscribers', { month: format.number(month), year: format.number(year) })}
            {olderPrice > 0 && <span> · {t('plans.olderPrice', { count: olderPrice })}</span>}
          </p>
        </>
      ) : (
        <p className={styles.meta}>{t('plans.freePrice')}</p>
      )}
      <p className={styles.footnote}>
        {t('plans.features', { count: plan.features.length })} · {t('plans.updated', { date: format.date(plan.updatedAt) })}
      </p>
    </Panel>
  )
}

/**
 * Admin › Payments › Plans (2026-11-13): the plans of each role with their prices and subscribers. `finance.manage`
 * edits names, features and prices (a new price is for new subscribers only); `finance.view` reads them.
 */
export default function PlansPage() {
  const { t } = useTranslation('adminPayments')
  const { me } = usePreferences()
  const manage = can(me, 'finance.manage')
  const { data: plans, isError } = useGetAdminPlansQuery(undefined, { refetchOnMountOrArgChange: true })
  const { data: payments } = useGetAdminPaymentsQuery({ page: 1 })
  const [openKey, setOpenKey] = useState(null)
  const [notice, setNotice] = useState('')
  const open = plans?.find((plan) => plan.key === openKey)

  return (
    <>
      <PageTitle title={t('plans.title')} description={t('plans.description')} />
      <PaymentsTabs value="plans" payments={payments?.total} plans={plans?.length} />
      {notice && <NoticeBanner>{notice}</NoticeBanner>}
      {isError && <NoticeBanner>{t('plans.loadError')}</NoticeBanner>}
      {!plans && !isError && (
        <SkeletonRegion className={`${styles.role} ${styles.grid}`}>
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} height={190} />
          ))}
        </SkeletonRegion>
      )}
      {plans &&
        ROLES.map((role) => (
          <section key={role} className={styles.role} aria-labelledby={`plans-${role}`}>
            <h2 id={`plans-${role}`} className={styles.roleTitle}>
              {t(`plans.roles.${role}`)}
            </h2>
            <div className={styles.grid}>
              {plans
                .filter((plan) => plan.role === role)
                .map((plan) => (
                  <PlanSummary key={plan.key} plan={plan} manage={manage} onOpen={() => setOpenKey(plan.key)} />
                ))}
            </div>
          </section>
        ))}
      {open && (
        <PlanEditor
          plan={open}
          manage={manage}
          onClose={() => setOpenKey(null)}
          onSaved={(saved) => {
            setOpenKey(null)
            setNotice(t('plans.saved', { plan: saved.name.en }))
          }}
        />
      )}
    </>
  )
}
