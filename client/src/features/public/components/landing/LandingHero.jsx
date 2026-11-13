import { MapPin, Search } from 'lucide-react'
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BRAND } from '@/app/brand.js'
import avatar1 from '@/assets/landing/avatar-1.webp'
import avatar2 from '@/assets/landing/avatar-2.webp'
import avatar3 from '@/assets/landing/avatar-3.webp'
import cardBottom from '@/assets/landing/hero-card-bottom.svg'
import cardMan from '@/assets/landing/hero-card-man.svg'
import cardTop from '@/assets/landing/hero-card-top.svg'
import cardWoman from '@/assets/landing/hero-card-woman.svg'
import maskMan from '@/assets/landing/hero-mask-man.svg'
import maskWoman from '@/assets/landing/hero-mask-woman.svg'
import photoMan from '@/assets/landing/hero-man.webp'
import orbit1 from '@/assets/landing/hero-orbit-1.svg?raw'
import orbit2 from '@/assets/landing/hero-orbit-2.svg?raw'
import orbit3 from '@/assets/landing/hero-orbit-3.svg'
import sparkles from '@/assets/landing/hero-sparkles.svg'
import photoWoman from '@/assets/landing/hero-woman.webp'
import hexagons from '@/assets/landing/pattern-hexagons.svg?raw'
import BrandLogo from '@/components/layout/BrandLogo.jsx'
import { Icon } from '@/components/ui'
import InlineSvg from './InlineSvg.jsx'
import styles from './Landing.module.css'
import { NAV, navItemOf } from './siteNav.js'

/** Pill with the round ↗ badge used across the Figma page. */
export function ArrowPill({ to, children, white = false }) {
  return (
    <Link to={to} className={white ? `${styles.pill} ${styles.pillWhite}` : styles.pill}>
      {children}
      <span className={styles.arrow} aria-hidden="true">
        ↗
      </span>
    </Link>
  )
}

/** The overlapping people of the design with the round "+" (hero and job cards). */
export function AvatarStack({ to, label }) {
  return (
    <Link to={to} className={styles.avatars} aria-label={label}>
      {[avatar1, avatar2, avatar3, avatar1].map((src, index) => (
        <span key={index} className={styles.avatar}>
          <img src={src} alt="" className={src === avatar1 ? styles.avatarLarge : styles.avatarSmall} />
        </span>
      ))}
      <span className={styles.avatar}>
        <span className={styles.avatarMore} aria-hidden="true">
          +
        </span>
      </span>
    </Link>
  )
}

/** The pill nav and Login of every public page; the current page's item is filled. */
export function SiteHeader({ className = '' }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const current = pathname === '/' ? '/' : navItemOf(pathname)
  return (
    <header className={`${styles.header} ${className}`} data-hero-header>
      <Link to="/" className={styles.brandLink} aria-label={t('landing:nav.home_aria', { brand: BRAND.name })}>
        <BrandLogo height={52} />
      </Link>
      <nav className={styles.navWrap} aria-label={t('landing:nav.label')}>
        <div className={styles.nav}>
          {NAV.map(([to, key]) => (
            <Link key={key} to={to} className={to === current ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem} aria-current={to === current ? 'page' : undefined}>
              {t(`landing:nav.${key}`)}
            </Link>
          ))}
        </div>
      </nav>
      <ArrowPill to="/sign-in">{t('landing:nav.signIn')}</ArrowPill>
    </header>
  )
}

/** A box placed at Figma coordinates inside the 468 × 445 art frame. */
const at = (left, top, width, height) => ({ left, top, width, height })

/** The two photo cards, quotes and orbit line on the right of the hero (Figma 396:711). */
function HeroArt() {
  const { t } = useTranslation()
  return (
    <div className={styles.art} aria-hidden="true" data-hero-art data-parallax="-70">
      <img src={cardWoman} alt="" style={{ ...at(0, 8, 261, 290.4) }} />
      {/* Figma 457:9050: the cut-out photo mirrored (laptop on the left), clipped by the card shape. */}
      <div className={styles.maskedPhoto} style={{ ...at(7, 8, 277, 277), maskImage: `url("${maskWoman}")`, WebkitMaskImage: `url("${maskWoman}")`, maskPosition: '-7px 0', WebkitMaskPosition: '-7px 0', maskSize: '261px 290.445px', WebkitMaskSize: '261px 290.445px' }}>
        <img src={photoWoman} alt="" style={{ left: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
      </div>
      <div className={styles.flipY} style={at(277, 151.5, 191, 288.5)}>
        <img src={cardMan} alt="" style={{ width: '100%', height: '97.02%' }} />
      </div>
      <img src={sparkles} alt="" style={{ ...at(292, 187, 48, 45.5), opacity: 0.5 }} data-twinkle data-sparkle />
      {/* Figma 457:23289: the cut-out photo, clipped by the card shape. */}
      <div className={styles.maskedPhoto} style={{ ...at(225, 127, 274, 414), maskImage: `url("${maskMan}")`, WebkitMaskImage: `url("${maskMan}")`, maskPosition: '52px 55.227px', WebkitMaskPosition: '52px 55.227px', maskSize: '191px 257.773px', WebkitMaskSize: '191px 257.773px' }}>
        <img src={photoMan} alt="" style={{ left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div className={styles.flipY} style={at(277, 8, 190, 164)}>
        <img src={cardTop} alt="" style={{ position: 'absolute', top: 0, left: 0, width: '99.61%', height: '94.89%' }} />
      </div>
      <p className={styles.artQuote} style={{ left: 297, top: 28, width: 150 }}>
        {t('landing:hero.talentTitle')}
      </p>
      <p className={styles.artText} style={{ left: 297, top: 75, width: 160 }}>
        {t('landing:hero.talentText')}
      </p>
      <img src={cardBottom} alt="" style={at(0, 266.9, 261, 175)} />
      <p className={`${styles.artQuote} ${styles.artQuoteLarge}`} style={{ left: 20, top: 334, width: 227 }}>
        {t('landing:hero.remoteTitle')}
      </p>
      <p className={styles.artText} style={{ left: 20, top: 381, width: 227 }}>
        {t('landing:hero.remoteText')}
      </p>
      <InlineSvg svg={orbit1} className={styles.inlineArt} style={at(-0.4, 186, 35.6, 32.7)} motion="orbit" />
      <InlineSvg svg={orbit2} className={styles.inlineArt} style={at(22.8, 138.6, 238.6, 85)} motion="orbit" />
      <img src={orbit3} alt="" style={at(3, 208.85, 19.8, 23.9)} data-sparkle />
    </div>
  )
}

/** Header, search and photo cards (Figma 396:549). The search sends signed-out visitors through sign-in to the job list. */
export default function LandingHero() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [what, setWhat] = useState('')
  const [where, setWhere] = useState('')

  function search(event) {
    event.preventDefault()
    const q = `${what} ${where}`.trim()
    navigate(q ? `/candidate/jobs?q=${encodeURIComponent(q)}` : '/candidate/jobs')
  }

  return (
    <section className={styles.hero} id="home">
      <InlineSvg svg={hexagons} className={styles.heroPattern} motion="pattern" data-parallax="90" />
      <SiteHeader />

      <div className={styles.heroBody}>
        <div className={styles.heroText}>
          <h1 className={styles.heroTitle}>
            <span className={styles.heroLine}>
              <span data-hero-line>{t('landing:hero.titleLead')}</span>
            </span>
            <span className={styles.heroLine}>
              <span data-hero-line>
                <Trans i18nKey="landing:hero.titleWith" values={{ brand: BRAND.name }} components={{ brand: <em className={styles.heroBrand} /> }} />
              </span>
            </span>
          </h1>

          <form className={styles.search} data-hero-fade role="search" aria-label={t('landing:hero.searchLabel')} onSubmit={search}>
            <label className={styles.searchField}>
              <Icon as={Search} size={16} />
              <input value={what} onChange={(event) => setWhat(event.target.value)} placeholder={t('landing:hero.what')} aria-label={t('landing:hero.what')} />
            </label>
            <label className={styles.searchField}>
              <Icon as={MapPin} size={16} />
              <input value={where} onChange={(event) => setWhere(event.target.value)} placeholder={t('landing:hero.where')} aria-label={t('landing:hero.where')} />
            </label>
            <button type="submit" className={styles.searchButton}>
              <Icon as={Search} size={16} />
              <span className={styles.searchLabel}>{t('landing:hero.search')}</span>
            </button>
          </form>

          <p className={styles.heroCopy} data-hero-fade>{t('landing:hero.text')}</p>

          <div className={styles.heroActions} data-hero-fade>
            <ArrowPill to="/sign-up">{t('landing:hero.start')}</ArrowPill>
            <AvatarStack to="/sign-up" label={t('landing:hero.join')} />
          </div>
        </div>
        <HeroArt />
      </div>
    </section>
  )
}
