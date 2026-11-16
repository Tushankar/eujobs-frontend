/**
 * An email address that, when too long for its line, wraps at its natural points (before the "@", after a "+" or
 * "." in the name) rather than splitting a letter off the end.
 */
export default function EmailText({ email }) {
  const at = email.lastIndexOf('@')
  if (at <= 0) return email
  const parts = email.slice(0, at).split(/(?<=[+.])/)
  return (
    <>
      {parts.map((part, index) => (
        <span key={index}>
          {part}
          <wbr />
        </span>
      ))}
      {email.slice(at)}
    </>
  )
}
