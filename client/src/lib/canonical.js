import { useEffect } from 'react'

/**
 * A page's canonical address (2026-11-24): the same job is reachable on the main site and on its sector site, so its
 * page names one of them for search engines. `href` null leaves no canonical link.
 */
export function useCanonical(href) {
  useEffect(() => {
    if (!href) return undefined
    const link = document.createElement('link')
    link.rel = 'canonical'
    link.href = href
    document.head.appendChild(link)
    return () => link.remove()
  }, [href])
}
