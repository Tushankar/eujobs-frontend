import { cx } from '@/utils/cx.js'
import styles from './DataTable.module.css'

/**
 * Semantic table in the DS list style: pale header row, bordered card.
 * `columns` = [{ key, header, label?, width?, render(row) }]. The table fits its container; when the container
 * is narrow, each row becomes a stacked card (the first column as its title, the rest as "label  value" lines),
 * so a table never scrolls sideways. `label` names a column whose `header` is not plain text.
 */
export default function DataTable({ columns, rows, getRowKey, caption, className }) {
  const labelOf = (column) => column.label ?? (typeof column.header === 'string' ? column.header : undefined)
  return (
    <div className={cx(styles.card, className)}>
      <div className={styles.scroll}>
        <table className={styles.table}>
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
          <tbody>
            {rows.map((row) => (
              <tr key={getRowKey(row)} className={styles.row}>
                {columns.map((column) => (
                  <td key={column.key} className={styles.td} data-label={labelOf(column)}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
