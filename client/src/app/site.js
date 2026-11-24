import { redirect } from 'react-router-dom'
import { api, useGetSiteQuery } from './api.js'
import { store } from './store.js'

/*
 * Sector sites (2026-11-24): one frontend on every domain. On a sector site (eujobs.health, …) the landing page and /jobs
 * show that site's jobs; everything that needs an account opens on the main site (eujobs.careers), path and query kept,
 * since a session belongs to one domain. `?site=eujobs.health` previews a site on any host (local testing) for this
 * browser tab; `?site=` ends the preview.
 */
const PREVIEW_KEY = 'eujobs.sitePreview'

/** Pages a sector site serves itself; the rest go to the main site. */
const SITE_PAGES = [/^\/$/, /^\/jobs\/?$/, /^\/legal\//, /^\/blog(\/|$)/, /^\/certificates\//, /^\/newsletter\//]

export function siteHost() {
  try {
    const preview = new URLSearchParams(window.location.search).get('site')
    if (preview !== null) {
      if (preview) window.sessionStorage.setItem(PREVIEW_KEY, preview)
      else window.sessionStorage.removeItem(PREVIEW_KEY)
    }
    return window.sessionStorage.getItem(PREVIEW_KEY) || window.location.hostname
  } catch {
    return window.location.hostname
  }
}

/** The site of this domain ({ site, mainOrigin }); a failed read counts as the main site, so the app still opens. */
export async function loadSite() {
  const { data } = await store.dispatch(api.endpoints.getSite.initiate(siteHost(), { subscribe: false }))
  return data ?? { site: null, mainOrigin: window.location.origin }
}

/**
 * Root loader: on a sector site, a page it does not serve opens on the main site. A preview on the main site's own
 * domain just ends there (the same origin would open the preview again).
 */
export async function siteLoader({ request }) {
  const { site, mainOrigin } = await loadSite()
  const url = new URL(request.url)
  if (!site || SITE_PAGES.some((page) => page.test(url.pathname))) return null
  if (mainOrigin === window.location.origin) {
    try {
      window.sessionStorage.removeItem(PREVIEW_KEY)
    } catch {
      // Storage blocked: there was no preview to end.
    }
    return null
  }
  url.searchParams.delete('site')
  return redirect(`${mainOrigin}${url.pathname}${url.search}`)
}

/** { site, mainOrigin, host } for pages; `site` is null on the main site and while it loads. */
export function useSite() {
  const host = siteHost()
  const { data } = useGetSiteQuery(host)
  return { site: data?.site ?? null, mainOrigin: data?.mainOrigin ?? window.location.origin, host: data?.site?.host ?? null }
}
