import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Panel, SelectField } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { useErrorText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { useDecideCvRequestMutation, useGetCvDownloadsQuery, useGetCvRequestsQuery } from '../api.js'
import styles from './CvRequests.module.css'

/** One pending request: approve by choosing the version to share (A: recruiter RQ-44), or decline. */
function PendingRequest({ request, versions }) {
  const { t } = useTranslation()
  const format = useFormat()
  const errorText = useErrorText()
  const [decide, { isLoading }] = useDecideCvRequestMutation()
  const [versionId, setVersionId] = useState('')
  const [error, setError] = useState(null)

  async function submit(decision) {
    if (decision === 'approved' && !versionId) return setError(t('cv:requests.needVersion'))
    setError(null)
    try {
      await decide({ id: request.id, decision, ...(decision === 'approved' && { versionId }) }).unwrap()
    } catch (failure) {
      setError(errorText.code(failure))
    }
  }

  return (
    <li className={styles.item} data-request={request.id}>
      <p className={styles.title}>{t('cv:requests.row', { company: request.company.displayName, reason: t(`enums:cvRequestReason.${request.reason}`) })}</p>
      <p className={styles.meta}>{t('cv:requests.received', { date: format.date(request.createdAt) })}</p>
      {request.details && <p className={styles.details}>{request.details}</p>}
      <div className={styles.actions}>
        <SelectField
          className={styles.select}
          label={t('cv:requests.version')}
          name={`share-${request.id}`}
          placeholder={t('cv:requests.versionPlaceholder')}
          options={versions.map((version) => ({ value: version.id, label: t('cv:requests.versionOption', { number: version.number, name: version.originalName }) }))}
          value={versionId}
          onChange={(event) => setVersionId(event.target.value)}
          error={error}
        />
        <div className={styles.buttons}>
          <Button variant="outline" disabled={isLoading} onClick={() => submit('declined')}>
            {t('cv:requests.decline')}
          </Button>
          <Button loading={isLoading} onClick={() => submit('approved')}>
            {t('cv:requests.approve')}
          </Button>
        </div>
      </div>
    </li>
  )
}

/** The CV page's requests from companies (M-029, U19) and the log of every company view (M-187, P4-D12). */
export default function CvRequests({ versions }) {
  const { t } = useTranslation()
  const format = useFormat()
  const { data: requests } = useGetCvRequestsQuery()
  const { data: downloads } = useGetCvDownloadsQuery()
  if (!requests || !downloads) return null

  return (
    <div className={styles.root}>
      <Panel padding={28}>
        <h2 className={styles.heading}>{t('cv:requests.title')}</h2>
        <p className={styles.lead}>{t('cv:requests.lead')}</p>
        {requests.items.length === 0 ? (
          <p className={styles.empty}>{t('cv:requests.empty')}</p>
        ) : (
          <ul className={styles.list}>
            {requests.items.map((request) =>
              request.status === 'pending' ? (
                <PendingRequest key={request.id} request={request} versions={versions} />
              ) : (
                <li key={request.id} className={styles.item} data-request={request.id}>
                  <p className={styles.title}>{t('cv:requests.row', { company: request.company.displayName, reason: t(`enums:cvRequestReason.${request.reason}`) })}</p>
                  <PillBadge tone={request.status === 'approved' ? 'success' : 'neutral'}>
                    {t('cv:requests.decidedOn', {
                      status: request.status === 'approved' ? t('cv:requests.approved', { number: request.versionNumber }) : t('cv:requests.declined'),
                      date: format.date(request.decidedAt),
                    })}
                  </PillBadge>
                </li>
              ),
            )}
          </ul>
        )}
      </Panel>

      <Panel padding={28}>
        <h2 className={styles.heading}>{t('cv:downloads.title')}</h2>
        <p className={styles.lead}>{t('cv:downloads.lead')}</p>
        {downloads.items.length === 0 ? (
          <p className={styles.empty}>{t('cv:downloads.empty')}</p>
        ) : (
          <ul className={styles.list}>
            {downloads.items.map((entry) => (
              <li key={entry.id} className={styles.logRow} data-download={entry.id}>
                <span>
                  {entry.version
                    ? t('cv:downloads.row', { company: entry.company.displayName, number: entry.version.number, name: entry.version.originalName })
                    : t('cv:downloads.removed', { company: entry.company.displayName })}
                </span>
                <time className={styles.meta} dateTime={entry.at}>
                  {format.dateTime(entry.at)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
