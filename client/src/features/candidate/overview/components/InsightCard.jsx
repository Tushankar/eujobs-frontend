import { Link } from 'react-router-dom'
import { ArrowRight, X } from 'lucide-react'
import { Icon, IconButton } from '@/components/ui'
import { useLocalStorage } from '@/hooks/useLocalStorage.js'
import aiGlyph from '@/assets/icons/ai-glyph-blue.svg'
import styles from './RailCards.module.css'

/** Dismissible AI insight teaser. Dismissal is remembered on this device. */
export default function InsightCard() {
  const [dismissed, setDismissed] = useLocalStorage('lwm.candidate.overview.insightDismissed', false)
  if (dismissed) return null

  return (
    <section className={styles.insight}>
      <div className={styles.insightHead}>
        <span className={styles.insightLabel}>
          <img src={aiGlyph} alt="" width={16} height={16} />
          A little insight, a big advantage
        </span>
        <IconButton icon={X} label="Dismiss insight" className={styles.dismiss} onClick={() => setDismissed(true)} />
      </div>
      <h2 className={styles.insightTitle}>
        Your design systems
        <br />
        experience is in demand.
      </h2>
      <p className={styles.insightText}>
        It’s mentioned in 2 of the available roles. Adding a project could help recruiters see your impact.
      </p>
      <Link to="/candidate/ai-insights" className={styles.insightLink}>
        Explore AI insights
        <Icon as={ArrowRight} size={12} />
      </Link>
    </section>
  )
}
