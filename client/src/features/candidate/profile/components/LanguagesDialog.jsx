import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X } from 'lucide-react'
import { useGetConfigQuery } from '@/app/api.js'
import { Button, Icon, IconButton, SelectField } from '@/components/ui'
import { useErrorText, useFormState } from '@/lib/forms.js'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import { useGetLanguageCodesQuery, useSetLanguagesMutation } from '../api.js'
import FormDialog from './FormDialog.jsx'
import dialogStyles from './FormDialog.module.css'

/** M-020, P3-D5: ISO 639-1 languages, named in the UI language, one level each. */
export default function LanguagesDialog({ open, languages, onSaved, onClose }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const format = useFormat()
  const { language } = usePreferences()
  const { data: config } = useGetConfigQuery()
  const { data: codes = [] } = useGetLanguageCodesQuery()
  const [setLanguages, { isLoading }] = useSetLanguagesMutation()
  const { values, set, errors, failure, run } = useFormState(() => ({ rows: languages.length ? languages : [{ code: '', level: '' }] }))
  const languageOptions = useMemo(
    () => codes.map((code) => ({ value: code, label: format.languageName(code) })).sort((a, b) => a.label.localeCompare(b.label, language)),
    [codes, format, language],
  )
  const levelOptions = (config?.enums.languageLevel ?? []).map((level) => ({ value: level, label: t(`enums:languageLevel.${level}`) }))
  const max = config?.limits.profile.languages.max ?? 0
  const update = (index, change) => set('rows', values.rows.map((row, i) => (i === index ? { ...row, ...change } : row)))

  async function handleSubmit() {
    const rows = values.rows.filter((row) => row.code || row.level)
    const used = rows.map((row) => row.code)
    const checks = {}
    rows.forEach((row, index) => {
      if (!row.code) checks[`${index}.code`] = { key: 'required' }
      else if (used.indexOf(row.code) !== index) checks[`${index}.code`] = { key: 'duplicate' }
      if (!row.level) checks[`${index}.level`] = { key: 'required' }
    })
    if (await run(checks, () => setLanguages(rows).unwrap())) onSaved()
  }

  return (
    <FormDialog open={open} title={t('profile:form.languages.title')} busy={isLoading} failure={failure} onClose={onClose} onSubmit={handleSubmit}>
      {values.rows.map((row, index) => (
        <div key={index} className={dialogStyles.listRow}>
          <SelectField
            label={t('profile:form.languages.language')}
            name={`language-${index}`}
            placeholder={t('profile:form.languages.choose')}
            options={languageOptions}
            value={row.code}
            onChange={(event) => update(index, { code: event.target.value })}
            error={errorText.field('language', errors[`${index}.code`] ?? errors[`languages.${index}.code`] ?? (index === 0 ? errors.languages : undefined))}
          />
          <SelectField
            label={t('profile:form.languages.level')}
            name={`level-${index}`}
            placeholder={t('profile:form.languages.level')}
            options={levelOptions}
            value={row.level}
            onChange={(event) => update(index, { level: event.target.value })}
            error={errorText.field('level', errors[`${index}.level`])}
          />
          <IconButton
            icon={X}
            className={dialogStyles.remove}
            label={t('profile:form.languages.remove', { language: row.code ? format.languageName(row.code) : index + 1 })}
            onClick={() => set('rows', values.rows.filter((_, i) => i !== index))}
          />
        </div>
      ))}
      {values.rows.length < max && (
        <div>
          <Button variant="secondary" size="sm" leftIcon={<Icon as={Plus} size={14} />} onClick={() => set('rows', [...values.rows, { code: '', level: '' }])}>
            {t('profile:form.languages.add')}
          </Button>
        </div>
      )}
    </FormDialog>
  )
}
