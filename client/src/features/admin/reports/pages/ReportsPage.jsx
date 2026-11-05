import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { can } from '@/app/permissions.js'
import PageTitle from '@/components/common/PageTitle.jsx'
import { downloadFromApi } from '@/lib/download.js'
import { browserTimeZone, useErrorText } from '@/lib/forms.js'
import { usePreferences } from '@/lib/preferences.js'
import { useCreateReportMutation, useGetReportsQuery } from '../api.js'
import ExportHistory from '../components/ExportHistory.jsx'
import ReportForm from '../components/ReportForm.jsx'
import styles from './ReportsPage.module.css'

/**
 * Reports (M-181 … M-183, U23): the server builds each report once (transcript, executive summary in the admin's
 * language, CSV snapshot) and downloads it; the history re-serves the same file. Generating needs `reports.export`.
 */
export default function ReportsPage() {
  const { t } = useTranslation('adminReports')
  const errorText = useErrorText()
  const { me } = usePreferences()
  const { data, isLoading: reportsLoading } = useGetReportsQuery()
  const [createReport, { isLoading }] = useCreateReportMutation()
  const [failure, setFailure] = useState('')
  const [status, setStatus] = useState('')
  const [downloading, setDownloading] = useState(null)
  const canExport = can(me, 'reports.export')

  async function download(report) {
    setDownloading(report.id)
    try {
      await downloadFromApi(`/admin/reports/${report.id}/download`)
    } catch (error) {
      setStatus(errorText.code(error))
    } finally {
      setDownloading(null)
    }
  }

  async function handleGenerate(fields) {
    setFailure('')
    setStatus('')
    try {
      const report = await createReport({ ...fields, tz: browserTimeZone() }).unwrap()
      await download(report)
      setStatus(t('generated', { filename: report.filename }))
    } catch (error) {
      setFailure(errorText.code(error))
    }
  }

  return (
    <>
      <PageTitle title={t('title')} description={t('description')} />
      <div role="status">{status && <p className={styles.status}>{status}</p>}</div>
      <div className={styles.grid}>
        {canExport && <ReportForm busy={isLoading} failure={failure} onGenerate={handleGenerate} />}
        <ExportHistory reports={data?.items ?? []} canDownload={canExport} downloading={downloading} onDownload={download} loading={reportsLoading} />
      </div>
    </>
  )
}
