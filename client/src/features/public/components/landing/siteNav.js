/**
 * The public site's nav, in the Figma order (Home, About Us, Jobs, Blog, Pricing Plan, Contact Us) plus the FAQ (owner
 * 2026-11-11). Pricing scrolls to the landing section (owner 2026-11-13); its third entry is the page it also stands for.
 */
export const NAV = [
  ['/', 'home'],
  ['/#about', 'about'],
  ['/#jobs', 'jobs'],
  ['/blog', 'blog'],
  ['/#pricing', 'pricing', '/pricing'],
  ['/#faq', 'faq'],
  ['/#contact', 'contact'],
]

/** The nav item of a public page other than home (Blog on /blog/…, Pricing Plan on /pricing). */
export const navItemOf = (pathname) => NAV.find(([to, , page = to]) => page !== '/' && !page.includes('#') && pathname.startsWith(page))?.[0]
