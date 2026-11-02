import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Bookmark, SearchX } from 'lucide-react'
import { Button } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import { useFormat } from '@/lib/preferences.js'
import { useGetShortlistQuery } from '@/features/recruiter/find-candidates/api.js'
import CandidateBrowser from '@/features/recruiter/find-candidates/components/CandidateBrowser.jsx'
import styles from './ShortlistsPage.module.css'

/**
 * Shortlists (M-079, M-137): the company's shortlist in the picker country, with the Find candidates search,
 * filters, sort and compare. Candidates who are no longer discoverable are only counted.
 */
export default function ShortlistsPage() {
  const { t } = useTranslation()
  const format = useFormat()

  return (
    <>
      <PageTitle eyebrow={t('discovery:find.eyebrow')} title={t('discovery:shortlists.title')} description={t('discovery:shortlists.description')} />
      <CandidateBrowser
        useList={useGetShortlistQuery}
        notice={(data) =>
          data.hiddenCount > 0 && (
            <p className={styles.hidden} role="status">
              {t('discovery:shortlists.hidden', { count: data.hiddenCount })}
            </p>
          )
        }
        extra={(candidate) => candidate.addedAt && t('discovery:shortlists.added', { name: candidate.addedBy ?? '', date: format.date(candidate.addedAt) })}
        empty={({ filtering, clear }) =>
          filtering ? (
            <EmptyState
              icon={SearchX}
              title={t('discovery:shortlists.emptyFiltered')}
              description={t('discovery:find.emptyText')}
              action={
                <Button variant="outline" onClick={clear}>
                  {t('discovery:find.clear')}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Bookmark}
              title={t('discovery:shortlists.empty')}
              description={t('discovery:shortlists.emptyText')}
              action={
                <Button as={Link} to="/recruiter/find-candidates">
                  {t('discovery:shortlists.find')}
                </Button>
              }
            />
          )
        }
      />
    </>
  )
}
