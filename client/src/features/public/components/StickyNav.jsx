import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { BRAND } from '@/app/brand.js'
import BrandLogo from '@/components/layout/BrandLogo.jsx'
import { ArrowPill } from './landing/LandingHero.jsx'
import { NAV, navItemOf } from './landing/siteNav.js'
import styles from './StickyNav.module.css'

gsap.registerPlugin(useGSAP, ScrollTrigger, ScrollToPlugin)

const SHOW_AFTER = 140
// On the home page, the section in view picks the highlighted item (top to bottom).
const SECTIONS = ['about', 'jobs', 'pricing', 'blog', 'faq', 'contact']
const REDUCE = '(prefers-reduced-motion: reduce)'

/**
 * The public pages' floating navbar (owner 2026-11-13): once the page scrolls past its own header, a glass pill
 * slides down and stays while scrolling; a highlight glides to the item of the section in view (home) or of the
 * current page. It slides away again at the top. With reduce motion it only fades.
 */
export default function StickyNav() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const home = pathname === '/'
  const bar = useRef(null)
  const track = useRef(null)
  const marker = useRef(null)
  const [section, setSection] = useState(null)
  // The home page's blog section belongs to the Blog item, which opens the /blog page.
  const current = home ? (section ? (section === 'blog' ? '/blog' : `/#${section}`) : '/') : navItemOf(pathname)

  // Show and hide with the scroll position.
  useGSAP(
    () => {
      // A light, quick slide-and-fade (owner: the first version felt heavy).
      const reduce = window.matchMedia(REDUCE).matches
      gsap.set(bar.current, { autoAlpha: 0, y: reduce ? 0 : -16 })
      const reveal = gsap.to(bar.current, { autoAlpha: 1, y: 0, duration: reduce ? 0.2 : 0.35, ease: 'power2.out', paused: true })
      // On the home page, the last section whose top has passed the upper third of the screen is the one being read.
      // Measured on every scroll, so sections that render after the landing data arrives count too.
      const readSection = () => {
        if (!home) return
        const line = window.innerHeight * 0.35
        // The passed section nearest the line, whatever the page order (the FAQ comes before the blog).
        const passed = SECTIONS.map((id) => [id, document.getElementById(id)?.getBoundingClientRect().top])
          .filter(([, top]) => top < line)
          .sort((a, b) => b[1] - a[1])
        setSection(passed[0]?.[0] ?? null)
      }
      ScrollTrigger.create({
        start: SHOW_AFTER,
        end: 'max',
        onEnter: () => reveal.timeScale(1).play(),
        onLeaveBack: () => reveal.timeScale(1.4).reverse(),
        onUpdate: readSection,
      })
      readSection()
    },
    { dependencies: [home], revertOnUpdate: true },
  )

  // On the home page the logo and Home glide back up to the hero (another page opens the home page at its top).
  function toHero(event) {
    if (!home) return
    event.preventDefault()
    const reduce = window.matchMedia(REDUCE).matches
    gsap.to(window, { duration: reduce ? 0 : 0.9, scrollTo: { y: 0 }, ease: 'power3.inOut' })
    history.replaceState(null, '', '/')
  }

  // The highlight glides to the current item.
  useLayoutEffect(() => {
    const item = track.current?.querySelector('[aria-current="page"]')
    if (!marker.current) return
    if (!item) {
      gsap.to(marker.current, { autoAlpha: 0, duration: 0.2 })
      return
    }
    const props = { x: item.offsetLeft, width: item.offsetWidth, autoAlpha: 1 }
    if (window.matchMedia(REDUCE).matches) gsap.set(marker.current, props)
    else gsap.to(marker.current, { ...props, duration: 0.35, ease: 'power2.out' })
  }, [current, t])

  return (
    <div ref={bar} className={styles.bar} role="navigation" aria-label={t('landing:nav.sticky')}>
      <Link to="/" className={styles.brand} aria-label={t('landing:nav.home_aria', { brand: BRAND.name })} onClick={toHero}>
        <BrandLogo height={30} />
      </Link>
      <div ref={track} className={styles.track}>
        <span ref={marker} className={styles.marker} aria-hidden="true" />
        {NAV.map(([to, key]) => (
          <Link
            key={key}
            to={to}
            className={to === current ? `${styles.item} ${styles.itemActive}` : styles.item}
            aria-current={to === current ? 'page' : undefined}
            onClick={to === '/' ? toHero : undefined}
          >
            {t(`landing:nav.${key}`)}
          </Link>
        ))}
      </div>
      <span className={styles.login}>
        <ArrowPill to="/sign-in">{t('landing:nav.signIn')}</ArrowPill>
      </span>
    </div>
  )
}
