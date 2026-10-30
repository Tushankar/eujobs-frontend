import PillBadge from './PillBadge.jsx'

/** Dot + label status pill used for match strength and application status. tone = success | info | violet | neutral. */
export default function StatusBadge({ tone = 'neutral', children, className }) {
  return (
    <PillBadge tone={tone} dot className={className}>
      {children}
    </PillBadge>
  )
}
