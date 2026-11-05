import { useTranslation } from 'react-i18next'
import { FileText } from 'lucide-react'
import { Button, Icon, Panel, Skeleton, SkeletonRegion } from '@/components/ui'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { useFormat } from '@/lib/preferences.js'
import styles from './ExportHistory.module.css'

/* Title and meta widths (px) of the placeholder reports. */
const SKELETON_ROWS = [
  [220, 300],
  [180, 260],
  [240, 280],
]

/** Stored report snapshots, newest first (M-183); "Download again" serves the same file. `loading` shows placeholder rows. */
export default function ExportHistory({ reports, canDownload, downloading, onDownload, loading }) {
  const { t } = useTranslation(['adminReports', 'enums'])
  const format = useFormat()
  return (
    <Panel padding={28}>
      <SectionTitle title={t('history.title')} />
      {loading ? (
        <SkeletonRegion>
          <ul className={styles.list}>
            {SKELETON_ROWS.map(([title, meta], index) => (
              <li key={index} className={styles.item}>
                <Skeleton shape="block" width={40} height={40} className={styles.skeletonIcon} />
                <div className={styles.itemText}>
                  <p className={styles.itemTitle}>
                    <Skeleton width={title} height={14} />
                  </p>
                  <p className={styles.itemMeta}>
                    <Skeleton width={meta} />
                  </p>
                  <p className={styles.itemContext}>
                    <span>
                      <Skeleton width="90%" />
                    </span>
                    <span>
                      <Skeleton width="70%" />
                    </span>
                  </p>
                </div>
                {canDownload && <Skeleton shape="pill" width={120} height={32} />}
              </li>
            ))}
          </ul>
        </SkeletonRegion>
      ) : reports.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>
            <Icon as={FileText} size={25} strokeWidth={2} />
          </span>
          <p className={styles.emptyTitle}>{t('history.empty')}</p>
          <p className={styles.emptyText}>{t('history.emptyText')}</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {reports.map((report) => (
            <li className={styles.item} key={report.id} data-report={report.id}>
              <span className={styles.itemIcon}>
                <Icon as={FileText} size={18} />
              </span>
              <div className={styles.itemText}>
                <p className={styles.itemTitle}>
                  {t(`types.${report.type}`)} · {t(`enums:reportPeriod.${report.period}`)}
                </p>
                <p className={styles.itemMeta}>
                  {t('history.meta', { filename: report.filename, date: format.dateTime(report.generatedAt), by: report.createdBy ?? '' })}
                </p>
                <p className={styles.itemContext} data-report-summary>
                  {report.aiSummary}
                </p>
                {(report.brief || report.voiceFileName) && (
                  <p className={styles.itemContext}>
                    {report.brief && <span>{t('history.brief', { brief: report.brief })}</span>}
                    {report.transcript && <span data-report-transcript>{t('history.transcript', { name: report.voiceFileName, text: report.transcript })}</span>}
                  </p>
                )}
              </div>
              {canDownload && (
                <Button variant="outline" size="sm" loading={downloading === report.id} onClick={() => onDownload(report)}>
                  {t('history.download')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
