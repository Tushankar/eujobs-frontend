import { useTranslation } from 'react-i18next'
import { useGetConfigQuery } from '@/app/api.js'
import { TextField } from '@/components/ui'
import { check, useErrorText, useFormState } from '@/lib/forms.js'
import { useSetLinksMutation } from '../api.js'
import FormDialog from './FormDialog.jsx'

// M-022: linkedin.com/in/… (country subdomains included) and any https link; the server checks the same.
const LINKEDIN = /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/[^/?#\s]+\/?$/i
const HTTPS = /^https:\/\/[^\s/$.?#].[^\s]*$/i

export default function LinksDialog({ open, links, onSaved, onClose }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const [setLinks, { isLoading }] = useSetLinksMutation()
  const { values, set, errors, failure, run } = useFormState(() => ({ ...links }))
  const max = config?.limits.profile.url.max

  async function handleSubmit() {
    const linkedin = values.linkedin.trim()
    const portfolio = values.portfolio.trim()
    const checks = {
      linkedin: check.maxLength(linkedin, max) ?? (linkedin && !LINKEDIN.test(linkedin) ? { key: 'invalid' } : undefined),
      portfolio: check.maxLength(portfolio, max) ?? (portfolio && !HTTPS.test(portfolio) ? { key: 'invalid' } : undefined),
    }
    if (await run(checks, () => setLinks({ linkedin, portfolio }).unwrap())) onSaved()
  }

  return (
    <FormDialog open={open} title={t('profile:form.links.title')} busy={isLoading} failure={failure} onClose={onClose} onSubmit={handleSubmit}>
      <TextField
        label={t('profile:form.links.linkedin')}
        name="linkedin"
        type="url"
        hint={t('profile:form.links.linkedinHint')}
        value={values.linkedin}
        onChange={(event) => set('linkedin', event.target.value)}
        error={errorText.field('linkedin', errors.linkedin)}
        data-autofocus
      />
      <TextField
        label={t('profile:form.links.portfolio')}
        name="portfolio"
        type="url"
        hint={t('profile:form.links.portfolioHint')}
        value={values.portfolio}
        onChange={(event) => set('portfolio', event.target.value)}
        error={errorText.field('portfolio', errors.portfolio)}
      />
    </FormDialog>
  )
}
