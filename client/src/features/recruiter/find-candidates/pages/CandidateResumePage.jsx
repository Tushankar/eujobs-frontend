import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useOutletContext } from 'react-router-dom'
import { Clock, Download, Eye, FileText } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { useFormat } from '@/lib/preferences.js'
import { useGetCandidateCvQuery } from '../api.js'
import EarlierVersionModal from '../components/EarlierVersionModal.jsx'
import ProfileSection from '../components/ProfileSection.jsx'
import styles from './CandidateResumePage.module.css'

const fileUrl = (path) => `${import.meta.env.VITE_API_URL ?? ''}${path}`

/** View and Download of one CV version through its signed URLs; the server logs each view (M-187). */
function VersionFile({ version, title, meta, live = false }) {
  const { t } = useTranslation()
  return (
    <div className={styles.file}>
      <div className={styles.fileRow}>
        <span className={styles.fileIcon}>
          <Icon as={FileText} size={20} strokeWidth={2} />
        </span>
        <div className={styles.fileText}>
          <p className={styles.fileName}>{title}</p>
          <p className={styles.fileMeta}>{meta}</p>
        </div>
        {live && (
          <PillBadge tone="success" dot>
            {t('discovery:resumeTab.live')}
          </PillBadge>
        )}
      </div>
      <div className={styles.fileActions}>
        <Button as="a" href={fileUrl(version.url)} target="_blank" rel="noopener noreferrer" leftIcon={<Icon as={Eye} size={13} strokeWidth={2} />}>
          {t('discovery:resumeTab.view')}
        </Button>
        <Button as="a" href={fileUrl(version.downloadUrl)} variant="outline" leftIcon={<Icon as={Download} size={13} strokeWidth={2} />}>
          {t('discovery:resumeTab.download')}
        </Button>
      </div>
    </div>
  )
}

/**
 * Resume tab (M-029, M-187, P4-D12, M-073, M-030): the live CV only when the candidate shares it, the CV sent with each
 * application to this company (or "removed" once the candidate deleted it), the versions shared through approved
 * requests, and the request flow.
 */
export default function CandidateResumePage() {
  const { t } = useTranslation()
  const format = useFormat()
  const { candidate } = useOutletContext()
  const { data: cv } = useGetCandidateCvQuery(candidate.id)
  const [requestOpen, setRequestOpen] = useState(false)
  const [sent, setSent] = useState(false)
  if (!cv) return null
  const pending = cv.requests.some((request) => request.status === 'pending')

  return (
    <ProfileSection labelledBy="resume-title">
      <div className={styles.inner}>
        <div className={styles.header}>
          <span className={styles.bigIcon}>
            <Icon as={FileText} size={25} strokeWidth={2} />
          </span>
          <SectionTitle
            id="resume-title"
            title={t(cv.live ? 'discovery:resumeTab.liveTitle' : 'discovery:resumeTab.title')}
            description={t(cv.resumeVisible ? 'discovery:resumeTab.liveDescription' : 'discovery:resumeTab.hiddenDescription')}
          />
        </div>

        {cv.live && (
          <VersionFile
            version={cv.live}
            live
            title={cv.live.originalName}
            meta={t('discovery:resumeTab.uploaded', { date: format.date(cv.live.createdAt), size: format.fileSize(cv.live.size) })}
          />
        )}

        {cv.applied.length > 0 && (
          <>
            <h3 className={styles.subheading}>{t('discovery:resumeTab.applied')}</h3>
            {cv.applied.map((entry) =>
              entry.cv ? (
                <VersionFile
                  key={entry.applicationId}
                  version={entry.cv}
                  title={t('discovery:resumeTab.appliedVersion', { number: entry.cv.number, name: entry.cv.originalName })}
                  meta={t('discovery:resumeTab.appliedRow', { job: entry.jobTitle, date: format.date(entry.appliedAt) })}
                />
              ) : (
                <p key={entry.applicationId} className={styles.request}>
                  {t('discovery:resumeTab.appliedRow', { job: entry.jobTitle, date: format.date(entry.appliedAt) })} · {t('discovery:resumeTab.removed')}
                </p>
              ),
            )}
          </>
        )}

        {cv.shared.length > 0 && (
          <>
            <h3 className={styles.subheading}>{t('discovery:resumeTab.shared')}</h3>
            {cv.shared.map((version) => (
              <VersionFile
                key={version.id}
                version={version}
                title={t('discovery:resumeTab.sharedVersion', { number: version.number, name: version.originalName })}
                meta={t('discovery:resumeTab.uploaded', { date: format.date(version.createdAt), size: format.fileSize(version.size) })}
              />
            ))}
          </>
        )}

        <p className={styles.request}>{t('discovery:resumeTab.request')}</p>
        <div className={styles.requestAction}>
          <Button variant="outline" disabled={pending} leftIcon={<Icon as={Clock} size={13} strokeWidth={2} />} onClick={() => setRequestOpen(true)}>
            {t('discovery:resumeTab.requestButton')}
          </Button>
        </div>
        {(sent || pending) && (
          <p className={styles.status} role="status">
            {t(sent ? 'discovery:resumeTab.sent' : 'discovery:resumeTab.pending')}
          </p>
        )}

        {cv.requests.length > 0 && (
          <>
            <h3 className={styles.subheading}>{t('discovery:resumeTab.requests')}</h3>
            <ul className={styles.requests}>
              {cv.requests.map((request) => (
                <li key={request.id}>
                  <span>{t('discovery:resumeTab.requestRow', { reason: t(`enums:cvRequestReason.${request.reason}`), date: format.date(request.createdAt) })}</span>
                  <PillBadge tone={request.status === 'approved' ? 'success' : request.status === 'declined' ? 'neutral' : 'warning'}>
                    {t(`discovery:resumeTab.requestStatus.${request.status}`)}
                  </PillBadge>
                </li>
              ))}
            </ul>
          </>
        )}

        <p className={styles.policy}>{t('discovery:resumeTab.logged')}</p>
      </div>

      {requestOpen && (
        <EarlierVersionModal
          candidate={candidate}
          onClose={() => setRequestOpen(false)}
          onSent={() => {
            setRequestOpen(false)
            setSent(true)
          }}
        />
      )}
    </ProfileSection>
  )
}
