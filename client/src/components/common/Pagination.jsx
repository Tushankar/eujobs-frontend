import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button, Icon } from '@/components/ui'
import { useFormat } from '@/lib/preferences.js'
import styles from './Pagination.module.css'

/** Server pagination of the admin tables (M-206): the range shown, the total and Previous / Next. Hidden for one page. */
export default function Pagination({ page, pageSize, total, onChange }) {
  const { t } = useTranslation()
  const format = useFormat()
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  return (
    <nav className={styles.pagination} aria-label={t('common:pagination.label')}>
      <p className={styles.range}>{t('common:pagination.range', { from: format.number(from), to: format.number(to), total: format.number(total) })}</p>
      <div className={styles.buttons}>
        <Button variant="outline" leftIcon={<Icon as={ChevronLeft} size={14} />} disabled={page <= 1} onClick={() => onChange(page - 1)}>
          {t('common:pagination.previous')}
        </Button>
        <span className={styles.page}>{t('common:pagination.page', { page: format.number(page), pages: format.number(pages) })}</span>
        <Button variant="outline" rightIcon={<Icon as={ChevronRight} size={14} />} disabled={page >= pages} onClick={() => onChange(page + 1)}>
          {t('common:pagination.next')}
        </Button>
      </div>
    </nav>
  )
}
