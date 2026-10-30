import { FileText } from 'lucide-react'
import { Button, Icon, Panel } from '@/components/ui'
import SectionTitle from '@/components/common/SectionTitle.jsx'
import { formatDateTime } from '@/features/admin/audit-logs/utils/formatDate.js'
import styles from './ExportHistory.module.css'

/** Reports generated on this device, newest first. Each can be generated again from the same local data. */
export default function ExportHistory({ exports, onDownload }) {
  return (
    <Panel padding={28}>
      <SectionTitle title="Export history" />
      {exports.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>
            <Icon as={FileText} size={25} strokeWidth={2} />
          </span>
          <p className={styles.emptyTitle}>Your first useful snapshot</p>
          <p className={styles.emptyText}>Generate a report to see its export history here.</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {exports.map((entry) => (
            <li className={styles.item} key={entry.id}>
              <span className={styles.itemIcon}>
                <Icon as={FileText} size={18} />
              </span>
              <div className={styles.itemText}>
                <p className={styles.itemTitle}>{entry.typeLabel}</p>
                <p className={styles.itemMeta}>
                  {entry.filename} · {formatDateTime(entry.generatedAt)}
                </p>
                {(entry.brief || entry.voiceNote) && (
                  <p className={styles.itemContext}>
                    {entry.brief && <span>Brief: {entry.brief}</span>}
                    {entry.voiceNote && <span>Voice note: {entry.voiceNote}</span>}
                  </p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => onDownload(entry)}>
                Download again
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
