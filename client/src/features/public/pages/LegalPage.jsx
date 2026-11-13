import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { FileText, Mail, Printer, Scale, ShieldCheck } from 'lucide-react'
import { useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Icon, Skeleton, SkeletonRegion } from '@/components/ui'
import { useDocumentTitle } from '@/components/layout/useDocumentTitle.js'
import { useFormat } from '@/lib/preferences.js'
import { useGetLegalQuery } from '../api.js'
import glow from '@/assets/landing/jobs-glow-blue.svg'
import circuit from '@/assets/landing/reviews-circuit.svg?raw'
import PublicShell from '../components/PublicShell.jsx'
import InlineSvg from '../components/landing/InlineSvg.jsx'
import { animateSvgs } from '../components/landing/svgMotion.js'
import landing from '../components/landing/Landing.module.css'
import styles from './LegalPage.module.css'

const DOCS = [
  ['terms', Scale],
  ['privacy', ShieldCheck],
  ['imprint', FileText],
]

/** The server HTML with an id on every section heading (for the contents list), and the headings themselves. */
function useSections(html) {
  return useMemo(() => {
    if (!html) return null
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const sections = [...doc.querySelectorAll('h2')].map((heading, index) => {
      heading.id = `section-${index + 1}`
      return { id: heading.id, text: heading.textContent }
    })
    return { html: doc.body.innerHTML, sections }
  }, [html])
}

/**
 * /legal/:doc (M-191, OD12; redesigned 2026-11-13 like professional company legal centres): the site header and footer,
 * a title band with version and dates, a sticky sidebar with the legal documents and this document's numbered
 * sections, the summary callout, numbered sections, print, and the contact card. The text is the current version in
 * the UI language, rendered and sanitised on the server, with the company details filled from its config.
 */
export default function LegalPage() {
  const { t, i18n } = useTranslation()
  const format = useFormat()
  const { doc } = useParams()
  const known = DOCS.some(([key]) => key === doc)
  // currentData: another document (tab or language) shows its placeholder, not the previous text, until it arrives.
  const { currentData: data, isError } = useGetLegalQuery({ doc, language: i18n.language }, { skip: !known })
  const article = useSections(data?.html)
  const hero = useRef(null)
  useDocumentTitle(known && t(`legal:docs.${doc}`))
  // The band's circuit traces in, pulses and drifts, and its glow breathes (not with reduce motion).
  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => animateSvgs(hero))
    },
    { scope: hero, dependencies: [doc], revertOnUpdate: true },
  )
  if (!known) return <Navigate to="/legal/terms" replace />
  const contact = data?.company?.[doc === 'privacy' ? 'privacyEmail' : 'email'] ?? data?.company?.email

  return (
    <PublicShell>
      <section ref={hero} className={`${landing.card} ${styles.hero}`} aria-labelledby="legal-title">
        <div className={styles.heroArt} aria-hidden="true">
          <img src={glow} alt="" className={styles.heroGlow} data-glow />
          <InlineSvg svg={circuit} className={styles.heroCircuit} motion="circuit" />
        </div>
        <p className={styles.eyebrow}>{t('legal:hub')}</p>
        {data ? (
          <div className={styles.heading}>
            <h1 id="legal-title" className={styles.title}>
              {data.title}
            </h1>
            <p className={styles.meta}>
              <span>{t('legal:effective', { date: format.date(data.publishedAt, { day: 'numeric', month: 'long', year: 'numeric' }) })}</span>
              <span aria-hidden="true">·</span>
              <span>{t('legal:version', { version: data.version })}</span>
            </p>
          </div>
        ) : (
          <SkeletonRegion>
            <Skeleton width={360} height={44} />
          </SkeletonRegion>
        )}
        {data?.isDraft && <p className={styles.draft}>{t('legal:draft')}</p>}
      </section>

      <section className={`${landing.card} ${styles.layout}`}>
        <aside className={styles.sidebar}>
          <nav aria-label={t('legal:nav')}>
            <p className={styles.sideTitle}>{t('legal:nav')}</p>
            <ul className={styles.docs}>
              {DOCS.map(([key, glyph]) => (
                <li key={key}>
                  <Link to={`/legal/${key}`} className={key === doc ? styles.docActive : undefined} aria-current={key === doc ? 'page' : undefined}>
                    <Icon as={glyph} size={16} />
                    {t(`legal:titles.${key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {article?.sections.length > 0 && (
            <nav aria-label={t('legal:contents')} className={styles.toc}>
              <p className={styles.sideTitle}>{t('legal:contents')}</p>
              <ol>
                {article.sections.map((section) => (
                  <li key={section.id}>
                    <a href={`#${section.id}`}>{section.text}</a>
                  </li>
                ))}
              </ol>
            </nav>
          )}
        </aside>

        <div className={styles.main}>
          {isError && (
            <p className={styles.error} role="alert">
              {t('legal:unavailable')}
            </p>
          )}
          {!data && !isError && (
            <SkeletonRegion>
              {[3, 4, 2].map((lines, section) => (
                <div key={section} className={styles.skeletonSection}>
                  <Skeleton width={220} height={16} />
                  {Array.from({ length: lines }, (_, line) => (
                    <Skeleton key={line} width={line === lines - 1 ? '60%' : '100%'} />
                  ))}
                </div>
              ))}
            </SkeletonRegion>
          )}
          {data && article && (
            <>
              <div className={styles.toolbar}>
                {data.language !== i18n.language && <p className={styles.note}>{t('legal:englishOnly')}</p>}
                <button type="button" className={styles.print} onClick={() => window.print()}>
                  <Icon as={Printer} size={15} />
                  {t('legal:print')}
                </button>
              </div>
              {/* Rendered and sanitised on the server (lib/markdown.js); company details filled from its config. */}
              <article className={styles.body} lang={data.language} dangerouslySetInnerHTML={{ __html: article.html }} />
              <aside className={styles.contact}>
                <span className={styles.contactIcon} aria-hidden="true">
                  <Icon as={Mail} size={18} />
                </span>
                <div>
                  <p className={styles.contactTitle}>{t('legal:contactTitle')}</p>
                  <p className={styles.contactText}>
                    {contact ? (
                      <>
                        {t('legal:contactText')} <a href={`mailto:${contact}`}>{contact}</a>
                      </>
                    ) : (
                      t('legal:contactPending')
                    )}
                  </p>
                </div>
              </aside>
            </>
          )}
        </div>
      </section>
    </PublicShell>
  )
}
