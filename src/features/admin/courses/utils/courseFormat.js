const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

/** "Sep 30, 2026" */
export function formatUpdated(iso) {
  return DATE_FORMAT.format(new Date(iso))
}

/** "Free" or "£39.00" */
export function formatPrice(price) {
  return price > 0 ? `£${price.toFixed(2)}` : 'Free'
}

/** Validation for the upload / manage course form. Returns { field: message } (empty when valid). */
export function validateCourse({ title, category, lessons, access, price }) {
  const errors = {}
  if (!title.trim()) errors.title = 'Enter a course title.'
  else if (title.trim().length < 3) errors.title = 'Course title needs at least 3 characters.'
  if (!category.trim()) errors.category = 'Enter a category or skill, for example Interaction Design.'
  const lessonCount = Number(lessons)
  if (!Number.isInteger(lessonCount) || lessonCount < 1 || lessonCount > 60) errors.lessons = 'Enter a whole number of lessons from 1 to 60.'
  if (access === 'paid') {
    const amount = Number(price)
    if (!(amount > 0) || amount > 999) errors.price = 'Enter a price above £0 and up to £999.'
  }
  return errors
}
