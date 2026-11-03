import { actorFor, recordAudit } from './audit.js'

/*
 * Server-built CSV files (OQ-6d): a UTF-8 BOM, CRLF rows and RFC 4180 quoting. Headers and labels come from the
 * requester's dictionary. Text that a spreadsheet would run as a formula is prefixed with an apostrophe.
 */
const FORMULA_START = /^[=+\-@\t\r]/

function cell(value) {
  if (value === null || value === undefined) return ''
  let text = String(value)
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export const toCsv = (rows) => `\uFEFF${rows.map((row) => row.map(cell).join(',')).join('\r\n')}\r\n`

export function sendCsv(res, filename, rows) {
  res.attachment(filename)
  res.type('text/csv; charset=utf-8')
  res.send(toCsv(rows))
}

/** Money as a decimal of the major unit ("9.00"); the currency goes in its own column. */
export const csvAmount = (amountMinor) => (amountMinor / 100).toFixed(2)

/** M-162: every export is audited (Reports category); the file name carries the day. */
export async function auditedExport(req, res, { type, name, rows }) {
  await recordAudit({ type: `reports.${type}`, category: 'reports', actor: actorFor(req.user), params: { count: rows.length - 1 } })
  sendCsv(res, `${name}-${new Date().toISOString().slice(0, 10)}.csv`, rows)
}
