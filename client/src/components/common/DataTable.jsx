import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui'
import { cx } from '@/utils/cx.js'
import styles from './DataTable.module.css'

const SKELETON_ROWS = 6
/* Line widths cycle per row so the placeholder rows read like real, uneven data. */
const WIDTHS = ['72%', '54%', '64%', '46%', '80%', '58%']

/**
 * One cell's placeholder, shaped like the content it stands for. `kind`: 'title' (a name over a meta line),
 * 'avatar' / 'logo' (that pair beside a round photo / square logo), 'text', 'pill' (a status) or 'action' (a button).
 * Shared with tables that render their own markup (JobsTable).
 */
export function SkeletonCell({ kind, row }) {
  const width = WIDTHS[row % WIDTHS.length]
  if (kind === 'text') return <Skeleton width={width} />
  if (kind === 'pill') return <Skeleton shape="pill" />
  if (kind === 'action') return <Skeleton shape="pill" width={84} height={32} />
  const lines = (
    <span className={styles.skeletonLines}>
      <Skeleton width={width} height={12} />
      <Skeleton width="40%" />
    </span>
  )
  if (kind === 'title') return lines
  return (
    <span className={styles.skeletonMedia}>
      <Skeleton shape="circle" width={36} height={36} className={kind === 'logo' ? styles.skeletonLogo : undefined} />
      {lines}
    </span>
  )
}

/** The default placeholder per column: the first is the row's title, an unlabeled one holds its actions. */
const skeletonKind = (column, index, label) => column.skeleton ?? (index === 0 ? 'title' : label ? 'text' : 'action')

/**
 * Semantic table in the DS list style: pale header row, bordered card.
 * `columns` = [{ key, header, label?, width?, skeleton?, render(row) }]. The table fits its container; when the
 * container is narrow, each row becomes a stacked card (the first column as its title, the rest as "label  value"
 * lines), so a table never scrolls sideways. `label` names a column whose `header` is not plain text. `getRowProps(row)`
 * adds attributes to a row (its `className` is merged).
 * `loading` (the first fetch) shows the real header over placeholder rows; `skeleton` picks a column's placeholder
 * (see SkeletonCell). `busy` (a refetch for new filters) dims the current rows until the new ones arrive.
 */
export default function DataTable({ columns, rows, getRowKey, getRowProps, caption, className, loading = false, busy = false }) {
  const { t } = useTranslation()
  const labelOf = (column) => column.label ?? (typeof column.header === 'string' ? column.header : undefined)
  return (
    <div className={cx(styles.card, className)} data-table-loading={loading || undefined}>
      {loading && (
        <span className="sr-only" role="status">
          {t('common:loading')}
        </span>
      )}
      <div className={styles.scroll}>
        <table className={styles.table} aria-busy={loading || busy || undefined}>
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col" className={styles.th} style={{ width: column.width }}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={cx(busy && !loading && styles.busy)}>
            {loading
              ? Array.from({ length: SKELETON_ROWS }, (_, row) => (
                  <tr key={row} className={cx(styles.row, styles.skeletonRow)} aria-hidden="true">
                    {columns.map((column, index) => (
                      <td key={column.key} className={styles.td} data-label={labelOf(column)}>
                        <SkeletonCell kind={skeletonKind(column, index, labelOf(column))} row={row} />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => {
                  const { className: rowClass, ...rowProps } = getRowProps?.(row) ?? {}
                  return (
                    <tr key={getRowKey(row)} className={cx(styles.row, rowClass)} {...rowProps}>
                      {columns.map((column) => (
                        <td key={column.key} className={styles.td} data-label={labelOf(column)}>
                          {column.render(row)}
                        </td>
                      ))}
                    </tr>
                  )
                })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
