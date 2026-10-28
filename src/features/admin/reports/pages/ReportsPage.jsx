import { useState } from 'react'
import PageTitle from '@/components/common/PageTitle.jsx'
import { useAuditLog } from '@/features/admin/audit-logs/hooks/useAuditLog.js'
import { useLocalStorage } from '@/hooks/useLocalStorage.js'
import { downloadCsv } from '@/utils/downloadCsv.js'
import ExportHistory from '../components/ExportHistory.jsx'
import ReportForm from '../components/ReportForm.jsx'
import { REPORT_TYPES, buildReportRows, reportFilename } from '../data/reports.js'
import styles from './ReportsPage.module.css'

/**
 * Reports. "Generate & download" builds a real CSV in the browser from the local demo data and saves it
 * to the device; nothing is uploaded. Each export is remembered in the history on this device.
 */
export default function ReportsPage() {
  const [exports, setExports] = useLocalStorage('lwm.admin.reports', [])
  const { record } = useAuditLog()
  const [status, setStatus] = useState('')

  function handleGenerate({ typeId, brief, voiceNote }) {
    const generatedAt = new Date().toISOString()
    const type = REPORT_TYPES.find((candidate) => candidate.id === typeId)
    const entry = {
      id: `export-${Date.now()}`,
      typeId,
      typeLabel: type.label,
      brief,
      voiceNote,
      generatedAt,
      filename: reportFilename(typeId, generatedAt),
    }
    downloadCsv(buildReportRows(entry), entry.filename)
    setExports((previous) => [entry, ...previous])
    record({
      title: 'Report exported',
      category: 'Reports',
      detail: `${type.label} was generated as ${entry.filename} in the browser and saved to this device. Nothing was uploaded.`,
    })
    setStatus(`${entry.filename} was generated in your browser and saved to this device. Nothing was uploaded.`)
  }

  function handleDownloadAgain(entry) {
    downloadCsv(buildReportRows(entry), entry.filename)
    setStatus(`${entry.filename} was generated again from the local data and saved to this device.`)
  }

  return (
    <>
      <PageTitle title="Useful data. Ready to share." description="Export clear, portable reports of your local marketplace activity." />
      <div role="status">{status && <p className={styles.status}>{status}</p>}</div>
      <div className={styles.grid}>
        <ReportForm onGenerate={handleGenerate} />
        <ExportHistory exports={exports} onDownload={handleDownloadAgain} />
      </div>
    </>
  )
}
