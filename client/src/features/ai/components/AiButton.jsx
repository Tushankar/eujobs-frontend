import PlanButton from '@/features/candidate/billing/components/PlanButton.jsx'

const LOCKED = { 'data-ai-locked': true }

/**
 * An AI action (M-118, §3.22): for a candidate without Plus or a recruiter without Recruiter Plus it stays visible with a
 * lock and opens the upgrade dialog, so a Free user never meets a button that fails; everyone else gets the action.
 */
export default function AiButton(props) {
  return <PlanButton entitlement="ai" roles={['candidate', 'recruiter']} lockedProps={LOCKED} {...props} />
}
