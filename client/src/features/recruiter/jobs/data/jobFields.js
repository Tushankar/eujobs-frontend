/*
 * The mock-job salary formatter, kept only for the admin Jobs and Moderation pages, which read the recruiter mocks
 * until Phase 10 (P4-D14). The wizard model is utils/jobForm.js.
 */
/** "$140k – $180k", "From $140k", "Up to $180k" or '' when no salary is set. */
export function formatSalary({ salaryMin, salaryMax }) {
  const short = (amount) => {
    const thousands = amount / 1000
    return `$${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}k`
  }
  if (salaryMin != null && salaryMax != null) return `${short(salaryMin)} – ${short(salaryMax)}`
  if (salaryMin != null) return `From ${short(salaryMin)}`
  if (salaryMax != null) return `Up to ${short(salaryMax)}`
  return ''
}
