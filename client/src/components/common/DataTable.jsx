import { cx } from '@/utils/cx.js'
import styles from './DataTable.module.css'

/**
 * Semantic table in the DS list style: pale header row, 81px rows, bordered card.
 * `columns` = [{ key, header, width?, render(row) }]. Wide tables scroll horizontally on small screens.
 */
export default function DataTable({ columns, rows, getRowKey, caption, className }) {
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
                  <td key={column.key} className={styles.td}>
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
