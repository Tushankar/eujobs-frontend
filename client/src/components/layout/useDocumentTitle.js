import { useEffect } from 'react'
import { BRAND } from '@/app/brand.js'

/** `<title>`: the translated page title followed by the brand. */
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${BRAND.name}` : `${BRAND.name} · ${BRAND.tagline}`
  }, [title])
}
