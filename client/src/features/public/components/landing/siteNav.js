/**
 * The public site's nav, in the Figma order (Home, About Us, Jobs, Blog, Pricing Plan, Contact Us) plus the FAQ (owner
 * 2026-11-11). Pricing scrolls to the landing section (owner 2026-11-13); its third entry is the page it also stands for.
 * Agencies (2026-11-23) opens the /agencies page.
 */
export const NAV = [
  ['/', 'home'],
  ['/#about', 'about'],
  ['/#jobs', 'jobs'],
  ['/agencies', 'agencies'],
  ['/blog', 'blog'],
  ['/#pricing', 'pricing', '/pricing'],
  ['/#faq', 'faq'],
  ['/#contact', 'contact'],
]

/** The nav item of a public page other than home (Blog on /blog/…, Pricing Plan on /pricing). */
export const navItemOf = (pathname) => NAV.find(([to, , page = to]) => page !== '/' && !page.includes('#') && pathname.startsWith(page))?.[0]
