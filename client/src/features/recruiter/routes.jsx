/*
 * Collects every feature's route list. Each feature folder directly under this one
 * owns a `routes.jsx` whose default export is an array of react-router route objects
 * with paths relative to this workspace (e.g. { path: 'jobs', lazy: lazyPage(...) }).
 * Shared pages (features/help) are mounted in every workspace.
 */
const modules = import.meta.glob(['./*/routes.jsx', '../help/routes.jsx'], { eager: true })

export default Object.values(modules).flatMap((module) => module.default)
