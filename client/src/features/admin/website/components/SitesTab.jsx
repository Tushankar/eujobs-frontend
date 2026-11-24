import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe, Plus } from 'lucide-react'
import { errorCode, useGetConfigQuery } from '@/app/api.js'
import DataTable from '@/components/common/DataTable.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import SectorPicker from '@/components/common/SectorPicker.jsx'
import { tableState } from '@/components/common/tableState.js'
import { Button, Checkbox, Field, Icon, Modal, TextareaField, TextField } from '@/components/ui'
import { check, compact, serverFieldErrors, useErrorText } from '@/lib/forms.js'
import { usePreferences } from '@/lib/preferences.js'
import { useSectors } from '@/lib/sectors.js'
import { useCreateSiteMutation, useGetAdminSitesQuery, useUpdateSiteMutation } from '../api.js'
import styles from '../pages/WebsitePage.module.css'

const LANGUAGES = ['en', 'es', 'fr']
const EMPTY_TEXT = { en: '', es: '', fr: '' }

/** Add a site, or edit one (its domain stays): what it lists and its hero line and intro in each language. */
function SiteDialog({ site, onClose, onSaved }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const [values, setValues] = useState(() => ({
    host: site?.host ?? '',
    sectors: site?.sectors ?? [],
    employmentTypes: site?.employmentTypes ?? [],
    remoteOnly: site?.remoteOnly ?? false,
    title: { ...EMPTY_TEXT, ...site?.title },
    text: { ...EMPTY_TEXT, ...site?.text },
  }))
  const [errors, setErrors] = useState({})
  const [failure, setFailure] = useState(null)
  const [create, { isLoading: creating }] = useCreateSiteMutation()
  const [update, { isLoading: updating }] = useUpdateSiteMutation()
  const S = config?.limits.site
  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))
  const setText = (field, code, value) => setValues((current) => ({ ...current, [field]: { ...current[field], [code]: value } }))
  const toggleType = (type) => set('employmentTypes', values.employmentTypes.includes(type) ? values.employmentTypes.filter((item) => item !== type) : [...values.employmentTypes, type])

  async function save(event) {
    event.preventDefault()
    const next = compact({
      ...(!site && { host: check.text(values.host, S.host.max) }),
      ...Object.fromEntries(LANGUAGES.flatMap((code) => [[`title.${code}`, check.text(values.title[code], S.title.max)], [`text.${code}`, check.text(values.text[code], S.text.max)]])),
    })
    setErrors(next)
    setFailure(null)
    if (Object.keys(next).length) return
    const trim = (texts) => Object.fromEntries(LANGUAGES.map((code) => [code, texts[code].trim()]))
    const body = { sectors: values.sectors, employmentTypes: values.employmentTypes, remoteOnly: values.remoteOnly, title: trim(values.title), text: trim(values.text) }
    try {
      const saved = await (site ? update({ host: site.host, ...body }) : create({ host: values.host.trim(), ...body })).unwrap()
      onSaved(saved, Boolean(site))
    } catch (error) {
      setErrors(serverFieldErrors(error))
      if (errorCode(error) !== 'VALIDATION_FAILED') setFailure(error)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={site ? t('website:admin.sites.editTitle', { host: site.host }) : t('website:admin.sites.addTitle')}
      description={t('website:admin.sites.dialogText')}
      width={640}
      divided
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('website:admin.sites.cancel')}
          </Button>
          <Button type="submit" form="site-form" loading={creating || updating}>
            {t('website:admin.sites.save')}
          </Button>
        </>
      }
    >
      <form id="site-form" className={styles.body} onSubmit={save} noValidate>
        {!site && (
          <TextField
            label={t('website:admin.sites.host')}
            hint={t('website:admin.sites.hostHint')}
            name="site-host"
            placeholder="eujobs.health"
            value={values.host}
            onChange={(event) => set('host', event.target.value)}
            error={errorText.field('host', errors.host)}
          />
        )}
        <SectorPicker
          name="siteSectors"
          label={t('website:admin.sites.sectors')}
          hint={t('website:admin.sites.sectorsHint')}
          value={values.sectors}
          max={config?.limits.sector.max ?? 60}
          onChange={(sectors) => set('sectors', sectors)}
          error={errorText.field('sectors', errors.sectors)}
        />
        <Field id="site-types" label={t('website:admin.sites.types')} hint={t('website:admin.sites.typesHint')}>
          <div className={styles.actions} id="site-types" role="group">
            {(config?.enums.employmentType ?? []).map((type) => (
              <Checkbox key={type} checked={values.employmentTypes.includes(type)} onChange={() => toggleType(type)}>
                {t(`enums:employmentType.${type}`)}
              </Checkbox>
            ))}
          </div>
        </Field>
        <Checkbox name="remoteOnly" checked={values.remoteOnly} onChange={(event) => set('remoteOnly', event.target.checked)}>
          {t('website:admin.sites.remoteOnly')}
        </Checkbox>
        {LANGUAGES.map((code) => (
          <div key={code} className={styles.body}>
            <TextField
              label={t(`website:admin.sites.title.${code}`)}
              name={`site-title-${code}`}
              maxLength={S?.title.max}
              value={values.title[code]}
              onChange={(event) => setText('title', code, event.target.value)}
              error={errorText.field(`title.${code}`, errors[`title.${code}`])}
            />
            <TextareaField
              label={t(`website:admin.sites.text.${code}`)}
              name={`site-text-${code}`}
              rows={2}
              maxLength={S?.text.max}
              value={values.text[code]}
              onChange={(event) => setText('text', code, event.target.value)}
              error={errorText.field(`text.${code}`, errors[`text.${code}`])}
            />
          </div>
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
 * Website › Sites (2026-11-24): the sector sites on their own domains (eujobs.health, …). Each lists the live jobs in its
 * sectors or job types (remote ones only when asked) under its own hero line; sign-in and everything after it happen on
 * the main site. A site that is off answers as the main site's copy until it is on again.
 */
export default function SitesTab({ manage, onNotice }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { language } = usePreferences()
  const sectors = useSectors()
  const result = useGetAdminSitesQuery()
  const [update] = useUpdateSiteMutation()
  // null: closed; {}: a new site; a site: editing it.
  const [editing, setEditing] = useState(null)
  const rows = result.data?.items ?? []
  const table = tableState(result, rows)

  async function toggle(site) {
    try {
      await update({ host: site.host, active: !site.active }).unwrap()
      onNotice(t(site.active ? 'website:admin.sites.notice.off' : 'website:admin.sites.notice.on', { host: site.host }))
    } catch (error) {
      onNotice(errorText.code(error))
    }
  }

  const lists = (site) =>
    [
      ...site.sectors.map((key) => sectors.name(key) ?? key),
      ...site.employmentTypes.map((type) => t(`enums:employmentType.${type}`)),
      site.remoteOnly && t('website:admin.sites.remoteOnlyShort'),
    ].filter(Boolean).join(' · ') || t('website:admin.sites.everyJob')

  const columns = [
    {
      key: 'host',
      header: t('website:admin.sites.site'),
      render: (site) => (
        <span data-site={site.host}>
          <strong className={styles.postTitle}>{site.host}</strong>
          <span className={styles.postMeta}>{site.title[language] ?? site.title.en}</span>
        </span>
      ),
    },
    { key: 'lists', header: t('website:admin.sites.lists'), render: lists },
    { key: 'jobs', header: t('website:admin.sites.liveJobs'), render: (site) => site.liveJobs },
    {
      key: 'status',
      header: t('website:admin.sites.status'),
      skeleton: 'pill',
      render: (site) => <PillBadge tone={site.active ? 'success' : 'neutral'}>{t(site.active ? 'website:admin.sites.on' : 'website:admin.sites.off')}</PillBadge>,
    },
    {
      key: 'actions',
      header: <span className="sr-only">{t('website:admin.sites.actions')}</span>,
      render: (site) =>
        manage && (
          <span className={styles.actions}>
            <Button variant="outline" size="sm" onClick={() => setEditing(site)}>
              {t('website:admin.sites.edit')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => toggle(site)}>
              {t(site.active ? 'website:admin.sites.turnOff' : 'website:admin.sites.turnOn')}
            </Button>
          </span>
        ),
    },
  ]

  return (
    <>
      <div className={styles.toolbar}>
        <p className={styles.postMeta}>{t('website:admin.sites.intro')}</p>
        {manage && (
          <Button leftIcon={<Icon as={Plus} size={14} />} onClick={() => setEditing({})} data-add-site>
            {t('website:admin.sites.add')}
          </Button>
        )}
      </div>
      {!table.loading && !rows.length ? (
        <EmptyState icon={Globe} title={t('website:admin.sites.empty')} />
      ) : (
        <DataTable columns={columns} rows={rows} getRowKey={(site) => site.host} loading={table.loading} busy={table.busy} caption={t('website:admin.sites.caption')} />
      )}
      {editing && (
        <SiteDialog
          site={editing.host ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={(saved, edited) => {
            setEditing(null)
            onNotice(t(edited ? 'website:admin.sites.notice.saved' : 'website:admin.sites.notice.added', { host: saved.host }))
          }}
        />
      )}
    </>
  )
}
