/*
 * 2026-11-20: the agency-only pages (clients, talent on the books, placements), mounted under /agency next to every
 * recruiter page (app/router.jsx). Each folder below owns a routes.jsx with paths relative to /agency.
 */
const modules = import.meta.glob('./*/routes.jsx', { eager: true })

export default Object.values(modules).flatMap((module) => module.default)
