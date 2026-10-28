import { Navigate } from 'react-router-dom'
import { lazyPage } from '@/app/lazyPage.js'

// 'Create your next role' (Figma 104:26470) is the first step of the Create a job wizard, which lives in jobs.
export default [
  { path: 'company', lazy: lazyPage(() => import('./pages/CompanyPage.jsx')) },
  { path: 'company/create-role', element: <Navigate to="/recruiter/jobs/new" replace /> },
]
