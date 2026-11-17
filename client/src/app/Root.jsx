import CelebrationHost from '@/features/celebrations/CelebrationHost.jsx'
import ScrollToTop from './ScrollToTop.jsx'

/** The router's root: every page, plus the success modals that can follow any page (2026-11-17). */
export default function Root() {
  return (
    <>
      <ScrollToTop />
      <CelebrationHost />
    </>
  )
}
