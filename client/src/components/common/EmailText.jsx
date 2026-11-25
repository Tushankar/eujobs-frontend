/**
 * An email address that, when too long for its line, wraps at its natural points (before the "@", after a "+" or
 * "." in the name) rather than splitting a letter off the end. One element, so a flex parent (a settings row's
 * value column) does not put each part on its own line (2026-11-25: "name" / "@gmail.com" stacked with room to spare).
 */
export default function EmailText({ email }) {
  const at = email.lastIndexOf('@')
  if (at <= 0) return email
  const parts = email.slice(0, at).split(/(?<=[+.])/)
  return (
    <span>
      {parts.map((part, index) => (
        <span key={index}>
          {part}
          <wbr />
        </span>
      ))}
      {email.slice(at)}
    </span>
  )
}
