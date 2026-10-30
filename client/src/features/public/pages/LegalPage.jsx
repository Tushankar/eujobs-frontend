import { useTranslation } from 'react-i18next'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Panel } from '@/components/ui'
import BrandLogo from '@/components/layout/BrandLogo.jsx'
import Copyright from '@/components/layout/Copyright.jsx'
import LanguagePicker from '@/components/layout/LanguagePicker.jsx'
import { useDocumentTitle } from '@/components/layout/useDocumentTitle.js'
import { useFormat } from '@/lib/preferences.js'
import { useGetLegalQuery } from '../api.js'
import styles from './LegalPage.module.css'

const DOCS = ['terms', 'privacy', 'imprint']

/**
 * /legal/:doc (M-191, OD12): the current version in the UI language, with a banner while it is a
 * draft. No Figma frame (OD16): built from the shell's logo, language picker and Panel.
 */
export default function LegalPage() {
  const { t, i18n } = useTranslation()
  const format = useFormat()
  const { doc } = useParams()
  const known = DOCS.includes(doc)
  const { data, isError } = useGetLegalQuery({ doc, language: i18n.language }, { skip: !known })
  useDocumentTitle(known && t(`legal:docs.${doc}`))
  if (!known) return <Navigate to="/legal/terms" replace />

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" aria-label={t('shell:brandHome')}>
          <BrandLogo height={36} />
        </Link>
        <LanguagePicker />
      </header>

      <main className={styles.main}>
        <nav className={styles.tabs} aria-label={t('legal:nav')}>
          {DOCS.map((entry) => (
            <Link key={entry} to={`/legal/${entry}`} className={entry === doc ? styles.active : undefined} aria-current={entry === doc ? 'page' : undefined}>
              {t(`legal:docs.${entry}`)}
            </Link>
          ))}
        </nav>

        <Panel padding={32} className={styles.panel}>
          {isError && <p role="alert">{t('legal:unavailable')}</p>}
          {!data && !isError && <p role="status">{t('common:loading')}</p>}
          {data && (
            <article lang={data.language}>
              {data.isDraft && <p className={styles.draft}>{t('legal:draft')}</p>}
              <h1 className={styles.title}>{data.title}</h1>
              <p className={styles.meta}>{t('legal:meta', { version: data.version, date: format.date(data.publishedAt) })}</p>
              {/* Rendered and sanitised on the server (lib/markdown.js). */}
              <div className={styles.body} dangerouslySetInnerHTML={{ __html: data.html }} />
            </article>
          )}
        </Panel>
      </main>

      <footer className={styles.footer}>
        <Copyright />
      </footer>
    </div>
  )
}
