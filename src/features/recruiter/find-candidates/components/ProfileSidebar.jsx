import { Bookmark, Mail, ShieldCheck } from 'lucide-react'
import { Button, Icon, Panel, SelectField } from '@/components/ui'
import MatchInsights from './MatchInsights.jsx'
import styles from './ProfileSidebar.module.css'

/**
 * Right column of the candidate profile: conversation + shortlist actions, hiring stage, the job to match
 * against, and the evidence panel. `stageOptions` = [{ value, label }].
 */
export default function ProfileSidebar({
  candidate,
  jobs,
  job,
  onJobChange,
  shortlisted,
  onToggleShortlist,
  stageId,
  stageOptions,
  onStageChange,
  onStartConversation,
  notice,
}) {
  return (
    <aside className={styles.sidebar}>
      <Panel padding={20}>
        <div className={styles.actions}>
          <Button fullWidth leftIcon={<Icon as={Mail} size={14} />} onClick={onStartConversation}>
            Start a conversation
          </Button>
          <Button
            variant="outline"
            fullWidth
            leftIcon={<Icon as={Bookmark} size={14} />}
            aria-pressed={shortlisted}
            onClick={onToggleShortlist}
          >
            {shortlisted ? 'Remove from shortlist' : 'Add to shortlist'}
          </Button>
        </div>
        <SelectField
          className={styles.stage}
          aria-label={`Hiring stage for ${candidate.name}`}
          value={stageId}
          onChange={(event) => onStageChange(event.target.value)}
          options={stageOptions}
        />
        {notice && (
          <p className={styles.notice} role="status">
            {notice}
          </p>
        )}
      </Panel>

      <Panel padding={20} className={styles.evidence}>
        <SelectField
          className={styles.job}
          label="Match evidence for"
          value={job?.id ?? ''}
          disabled={jobs.length === 0}
          onChange={(event) => onJobChange(event.target.value)}
          options={jobs.length > 0 ? jobs.map((item) => ({ value: item.id, label: item.title })) : [{ value: '', label: 'No open jobs' }]}
        />
        <MatchInsights candidate={candidate} job={job} defaultOpen />
      </Panel>

      <p className={styles.reminder}>
        <Icon as={ShieldCheck} size={17} />
        Review fairly. Profile evidence is a starting point, not a final assessment.
      </p>
    </aside>
  )
}
