import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { cx } from '@/utils/cx.js'
import { arrivedByFlip } from '@/utils/pageFlip.js'
import logo from '@/assets/images/logo.png'
import brandMark from '@/assets/images/auth-admin-brand-mark.png'
import aiSparkleWhite from '@/assets/icons/ai-sparkle-white.svg'
import styles from './AuthLayout.module.css'

// Every auth screen mounts its own AuthLayout, so the hero's intro would replay on each sign-in / sign-up
// switch. It only plays on the first one of the session; later screens keep the hero still and animate the form.
let heroIntroPlayed = false

/**
 * Split-screen shell for the Authentication frames: brand hero on the left (720px
 * in the 1440 design), form column on the right. The hero is hidden below 1024px.
 *
 * hero.quote   - quote under the lead paragraph
 * hero.footer  - small print at the bottom of the hero
 * hero.brand   - show the "LOCAL WORKMAN" wordmark at the top of the hero (admin frame)
 * showLogo     - logo above the form (every frame except admin sign-in)
 * logoTo       - where the form logo links to
 */
export default function AuthLayout({ children, hero, showLogo = true, logoTo = '/sign-in' }) {
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
            <span className={styles.heroBrandMark}>
              <img src={brandMark} alt="" />
            </span>
            LOCAL WORKMAN
          </p>
        )}
        <div className={styles.heroContent}>
          <p className={styles.heroBadge}>
            <img src={aiSparkleWhite} alt="" width={14} height={14} />
            AI-powered matching. Human decisions.
          </p>
          <h2 className={styles.heroTitle}>
            The right fit
            <br />
            changes
            <br />
            <span className={styles.heroAccent}>everything.</span>
          </h2>
          <p className={styles.heroLead}>
            A more thoughtful way to find your next opportunity, or the next great person for your team.
          </p>
          <p className={styles.heroQuote}>
            {hero?.quote ?? '“AI helps you discover the right opportunity or talent. You remain in control of the decision.”'}
          </p>
        </div>
        <p className={styles.heroFooter}>{hero?.footer ?? 'AI Job & Talent Matching Platform · matchpoint.'}</p>
      </section>

      <section className={styles.formSection}>
        <div className={cx(styles.formColumn, 'page-flip', !flippedIn && 'stagger')}>
          {showLogo && (
            <Link to={logoTo} className={styles.logo} aria-label="Local Worksmen — AI Job Portal">
              <img src={logo} alt="Local Worksmen, AI Job Portal" width={210} height={50} />
            </Link>
          )}
          {children}
        </div>
      </section>
    </div>
  )
}
