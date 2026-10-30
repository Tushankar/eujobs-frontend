import { useTranslation } from 'react-i18next'
import { Check, Download, FileText, Trash2 } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import PillBadge from '@/components/common/PillBadge.jsx'
import { useFormat } from '@/lib/preferences.js'
import styles from './VersionRow.module.css'

/** One CV version (M-028): any version can be downloaded; non-live ones can be set live or deleted. */
export default function VersionRow({ version, onSetLive, onDownload, onDelete }) {
  const { t } = useTranslation()
  const format = useFormat()
  const { number } = version
  return (
    <article className={styles.row} data-version={number}>
      <span className={styles.tile}>
        <Icon as={FileText} size={18} />
      </span>
      <div className={styles.body}>
        <div className={styles.titleLine}>
          <h3 className={styles.title}>{t('cv:version.title', { number, name: version.originalName })}</h3>
        </div>
        <div className={styles.status}>
          {version.live && (
            <PillBadge tone="success" dot>
              {t('cv:version.live')}
            </PillBadge>
          )}
          {version.noReadableText && <PillBadge tone="warning">{t('cv:version.noText')}</PillBadge>}
        </div>
        <p className={styles.meta}>{t('cv:version.meta', { date: format.dateTime(version.createdAt), size: format.fileSize(version.size) })}</p>
        {version.noReadableText && <p className={styles.note}>{t('cv:version.noTextHint')}</p>}
      </div>
      <div className={styles.actions}>
        <Button variant="outline" aria-label={t('cv:version.downloadLabel', { number })} leftIcon={<Icon as={Download} size={13} />} onClick={onDownload}>
          {t('cv:version.download')}
        </Button>
        {!version.live && (
          <>
            <Button aria-label={t('cv:version.setLiveLabel', { number })} leftIcon={<Icon as={Check} size={13} />} onClick={onSetLive}>
              {t('cv:version.setLive')}
            </Button>
            <Button variant="outline" aria-label={t('cv:version.deleteLabel', { number })} leftIcon={<Icon as={Trash2} size={13} />} onClick={onDelete}>
              {t('cv:version.delete')}
            </Button>
          </>
        )}
      </div>
    </article>
  )
}
