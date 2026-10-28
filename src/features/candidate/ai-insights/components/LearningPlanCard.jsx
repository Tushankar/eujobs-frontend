import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Icon, Panel } from '@/components/ui'
import SectionHeading from './SectionHeading.jsx'
import styles from './LearningPlanCard.module.css'

/** Skills the candidate chose to learn. A plan item never becomes a profile skill on its own. */
export default function LearningPlanCard({ plan, onRemove, exploreLabel, exploreTo }) {
  return (
    <Panel padding={24} aria-labelledby="learning-plan-title">
      <SectionHeading
        id="learning-plan-title"
        title="Your learning plan"
        description="A considered next step—not a new claim on your profile."
      />
      <div className={styles.box}>
        {plan.length === 0 ? (
          <p className={styles.text}>
            Add a skill from the gap analysis to start a plan. Learning progress never adds a skill to your profile automatically.
          </p>
        ) : (
          <>
            <ul className={styles.list}>
              {plan.map((skill) => (
                <li key={skill} className={styles.item}>
                  <span className={styles.skill}>{skill}</span>
                  <button type="button" className={styles.remove} onClick={() => onRemove(skill)}>
                    Remove<span className="sr-only"> {skill} from learning plan</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className={styles.text}>Learning progress never adds a skill to your profile automatically.</p>
          </>
        )}
        <Link to={exploreTo} className={styles.link}>
          {exploreLabel}
          <Icon as={ArrowRight} size={13} strokeWidth={2} />
        </Link>
      </div>
    </Panel>
  )
}
