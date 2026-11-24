import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Layers, Plus } from 'lucide-react'
import { errorCode, useGetConfigQuery } from '@/app/api.js'
import DataTable from '@/components/common/DataTable.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { tableState } from '@/components/common/tableState.js'
import { Button, Icon, Modal, TextField } from '@/components/ui'
import { check, compact, serverFieldErrors, useErrorText } from '@/lib/forms.js'
import { usePreferences } from '@/lib/preferences.js'
import { useCreateSectorMutation, useGetAdminSectorsQuery, useUpdateSectorMutation } from '../api.js'
import styles from '../pages/WebsitePage.module.css'

const LANGUAGES = ['en', 'es', 'fr']

/** Add a sector, or rename one: its name in English, Spanish and French. The key never changes. */
function SectorDialog({ sector, onClose, onSaved }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const [name, setName] = useState(() => ({ en: '', es: '', fr: '', ...sector?.name }))
  const [errors, setErrors] = useState({})
  const [failure, setFailure] = useState(null)
  const [create, { isLoading: creating }] = useCreateSectorMutation()
  const [update, { isLoading: updating }] = useUpdateSectorMutation()
  const max = config?.limits.sector.name.max ?? 60

  async function save(event) {
    event.preventDefault()
    const next = compact(Object.fromEntries(LANGUAGES.map((code) => [code, check.text(name[code], max)])))
    setErrors(next)
    setFailure(null)
    if (Object.keys(next).length) return
    const body = { name: Object.fromEntries(LANGUAGES.map((code) => [code, name[code].trim()])) }
    try {
      const saved = await (sector ? update({ key: sector.key, ...body }) : create(body)).unwrap()
      onSaved(saved, Boolean(sector))
    } catch (error) {
      // The server names the field as name.en.
      setErrors(Object.fromEntries(Object.entries(serverFieldErrors(error)).map(([field, value]) => [field.replace('name.', ''), value])))
      if (errorCode(error) !== 'VALIDATION_FAILED') setFailure(error)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t(sector ? 'website:admin.sectors.editTitle' : 'website:admin.sectors.addTitle')}
      description={t('website:admin.sectors.dialogText')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('website:admin.sectors.cancel')}
          </Button>
          <Button type="submit" form="sector-form" loading={creating || updating}>
            {t('website:admin.sectors.save')}
          </Button>
        </>
      }
    >
      <form id="sector-form" className={styles.body} onSubmit={save} noValidate>
        {LANGUAGES.map((code) => (
          <TextField
            key={code}
            label={t(`website:admin.sectors.name.${code}`)}
            name={`sector-${code}`}
            value={name[code]}
            maxLength={max}
            onChange={(event) => setName((current) => ({ ...current, [code]: event.target.value }))}
            error={errorText.field(code, errors[code])}
          />
        ))}
        {failure && (
          <p className={styles.postMeta} role="alert">
            {errorText.code(failure)}
          </p>
        )}
      </form>
    </Modal>
  )
}

/**
 * Website › Sectors (2026-11-24): the job sectors (the kind of work) with how many jobs and companies use each. Admins
 * with `content.manage` add and rename sectors (in every language) and hide one: a hidden sector stays on the jobs and
 * companies that have it but is no longer offered.
 */
export default function SectorsTab({ manage, onNotice }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { language } = usePreferences()
  const result = useGetAdminSectorsQuery()
  const [update] = useUpdateSectorMutation()
  // null: closed; {}: a new sector; a sector: renaming it.
  const [editing, setEditing] = useState(null)
  const rows = [...(result.data?.items ?? [])].sort((a, b) => (a.name[language] ?? a.name.en).localeCompare(b.name[language] ?? b.name.en, language))
  const table = tableState(result, rows)
  const nameOf = (sector) => sector.name[language] ?? sector.name.en

  async function toggle(sector) {
    try {
      await update({ key: sector.key, hidden: !sector.hidden }).unwrap()
      onNotice(t(sector.hidden ? 'website:admin.sectors.notice.shown' : 'website:admin.sectors.notice.hidden', { name: nameOf(sector) }))
    } catch (error) {
      onNotice(errorText.code(error))
    }
  }

  const columns = [
    {
      key: 'name',
      header: t('website:admin.sectors.sector'),
      render: (sector) => (
        <span data-sector={sector.key}>
          <strong className={styles.postTitle}>{nameOf(sector)}</strong>
          <span className={styles.postMeta}>
            {LANGUAGES.filter((code) => code !== language)
              .map((code) => sector.name[code])
              .join(' · ')}
          </span>
        </span>
      ),
    },
    { key: 'jobs', header: t('website:admin.sectors.jobs'), render: (sector) => t('website:admin.sectors.jobsValue', { count: sector.jobs, live: sector.liveJobs }) },
    { key: 'companies', header: t('website:admin.sectors.companies'), render: (sector) => sector.companies },
    {
      key: 'status',
      header: t('website:admin.sectors.status'),
      skeleton: 'pill',
      render: (sector) => <PillBadge tone={sector.hidden ? 'neutral' : 'success'}>{t(sector.hidden ? 'website:admin.sectors.hidden' : 'website:admin.sectors.shown')}</PillBadge>,
    },
    {
      key: 'actions',
      header: <span className="sr-only">{t('website:admin.sectors.actions')}</span>,
      render: (sector) =>
        manage && (
          <span className={styles.actions}>
            <Button variant="outline" size="sm" onClick={() => setEditing(sector)}>
              {t('website:admin.sectors.rename')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => toggle(sector)}>
              {t(sector.hidden ? 'website:admin.sectors.show' : 'website:admin.sectors.hide')}
            </Button>
          </span>
        ),
    },
  ]

  return (
    <>
      <div className={styles.toolbar}>
        <p className={styles.postMeta}>{t('website:admin.sectors.intro')}</p>
        {manage && (
          <Button leftIcon={<Icon as={Plus} size={14} />} onClick={() => setEditing({})} data-add-sector>
            {t('website:admin.sectors.add')}
          </Button>
        )}
      </div>
      {!table.loading && !rows.length ? (
        <EmptyState icon={Layers} title={t('website:admin.sectors.empty')} />
      ) : (
        <DataTable columns={columns} rows={rows} getRowKey={(sector) => sector.key} loading={table.loading} busy={table.busy} caption={t('website:admin.sectors.caption')} />
      )}
      {editing && (
        <SectorDialog
          sector={editing.key ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={(saved, renamed) => {
            setEditing(null)
            onNotice(t(renamed ? 'website:admin.sectors.notice.renamed' : 'website:admin.sectors.notice.added', { name: nameOf(saved) }))
          }}
        />
      )}
    </>
  )
}
