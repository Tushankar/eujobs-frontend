/** An email address that, when too long for its line, wraps before the "@" rather than splitting a letter off the end. */
export default function EmailText({ email }) {
  const at = email.lastIndexOf('@')
  if (at <= 0) return email
  return (
    <>
      {email.slice(0, at)}
      <wbr />
      {email.slice(at)}
    </>
  )
}
