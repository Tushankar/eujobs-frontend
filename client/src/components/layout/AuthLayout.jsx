import { useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useMatches } from 'react-router-dom'
import { BRAND } from '@/app/brand.js'
import { cx } from '@/utils/cx.js'
import { arrivedByFlip } from '@/utils/pageFlip.js'
import mark from '@/assets/images/logo-mark.png'
import aiSparkleWhite from '@/assets/icons/ai-sparkle-white.svg'
import BrandLogo from './BrandLogo.jsx'
import LanguagePicker from './LanguagePicker.jsx'
import { useDocumentTitle } from './useDocumentTitle.js'
import styles from './AuthLayout.module.css'

// Every auth screen mounts its own AuthLayout, so the hero's intro would replay on each sign-in / sign-up
// switch. It only plays on the first one of the session; later screens keep the hero still and animate the form.
let heroIntroPlayed = false

/**
 * Split-screen shell for the public pages: brand hero on the left (720px in the 1440 design),
 * form column on the right. The hero is hidden below 1024px. `hero.brand` shows the wordmark at
 * the top of the hero (admin frame); `showLogo` puts the logo above the form (every frame except
 * admin sign-in); `logoTo` is where it links. The page title comes from the route's `handle.titleKey`.
 */
export default function AuthLayout({ children, hero, showLogo = true, logoTo = '/sign-in' }) {
  const { t } = useTranslation()
  const titleKey = [...useMatches()].reverse().find((match) => match.handle?.titleKey)?.handle.titleKey
  useDocumentTitle(titleKey && t(`shell:${titleKey}`))
  const [playHeroIntro] = useState(() => !heroIntroPlayed)
  // Reached by a page flip (see utils/pageFlip.js): the flip is the entrance, so the form doesn't also cascade in.
  const [flippedIn] = useState(arrivedByFlip)
  useEffect(() => {
    heroIntroPlayed = true
  }, [])

  return (
    <div className={styles.layout}>
      <section className={cx(styles.hero, playHeroIntro && styles.heroIntro)} aria-hidden="true">
        <div className={styles.heroOverlay} />
        {hero?.brand && (
          <p className={styles.heroBrand}>
            <img src={mark} alt="" className={styles.heroBrandMark} />
            {BRAND.name}
          </p>
        )}
        <div className={styles.heroContent}>
          <p className={styles.heroBadge}>
            <img src={aiSparkleWhite} alt="" width={14} height={14} />
            {t('auth:hero.badge')}
          </p>
          <h2 className={styles.heroTitle}>
            <Trans i18nKey="auth:hero.title" components={{ br: <br />, accent: <span className={styles.heroAccent} /> }} />
          </h2>
          <p className={styles.heroLead}>{t('auth:hero.lead')}</p>
          <p className={styles.heroQuote}>{t('auth:hero.quote')}</p>
        </div>
        <p className={styles.heroFooter}>{t('auth:hero.footer', { brand: BRAND.name })}</p>
      </section>

      <section className={styles.formSection}>
        <div className={cx(styles.formColumn, 'page-flip', !flippedIn && 'stagger')}>
          <div className={styles.topBar}>
            {showLogo && (
              <Link to={logoTo} className={styles.logo} aria-label={t('shell:brandHome')}>
                <BrandLogo height={50} />
              </Link>
            )}
            <LanguagePicker />
          </div>
          {children}
        </div>
      </section>
    </div>
  )
}
