import { useLayoutEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigationType } from 'react-router-dom'

/**
 * Every page opens at the top: a new path scrolls the window up. Back/Forward (POP) keeps the browser's position, and
 * a change of only the query (filters, tabs) does not move the page.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()
  const lastPathname = useRef(pathname)
  useLayoutEffect(() => {
    if (lastPathname.current === pathname) return
    lastPathname.current = pathname
    if (navigationType !== 'POP') window.scrollTo(0, 0)
  }, [pathname, navigationType])
  return <Outlet />
}
