import { useTranslation } from 'react-i18next'
import { SearchX } from 'lucide-react'
import { Button } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import { useGetCandidatesQuery } from '../api.js'
import CandidateBrowser from '../components/CandidateBrowser.jsx'
import styles from './FindCandidatesPage.module.css'

/** Find candidates (M-054, M-055): the picker country's discoverable, consenting, complete candidates. */
export default function FindCandidatesPage() {
  const { t } = useTranslation()
  const format = useFormat()
  const { country } = usePreferences()

  return (
    <>
      <PageTitle eyebrow={t('discovery:find.eyebrow')} title={t('discovery:find.title')} description={t('discovery:find.description')} />
      <p className={styles.view}>{country === 'REMOTE' ? t('discovery:find.remoteView') : t('discovery:find.countryView', { country: format.country(country) })}</p>
      <CandidateBrowser
        useList={useGetCandidatesQuery}
        empty={({ clear }) => (
          <EmptyState
            icon={SearchX}
            title={t('discovery:find.empty')}
            description={t('discovery:find.emptyText')}
            action={
              <Button variant="outline" onClick={clear}>
                {t('discovery:find.clear')}
              </Button>
            }
          />
        )}
      />
    </>
  )
}
