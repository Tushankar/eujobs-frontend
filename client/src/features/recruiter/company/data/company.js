/*
 * Recruiter company profile (mock data). Edits are persisted to localStorage by CompanyPage
 * under COMPANY_STORAGE_KEY, so other recruiter screens can read the saved company the same way.
 */
export const COMPANY_STORAGE_KEY = 'lwm.recruiter.company'

export const COMPANY_SIZES = [
  '1–10 employees',
  '11–50 employees',
  '51–200 employees',
  '201–500 employees',
  '501–1,000 employees',
  '1,000+ employees',
]

export const INITIAL_COMPANY = {
  name: 'Acme Studio',
  industry: 'Enterprise SaaS',
  location: 'San Francisco, US',
  website: 'https://acme.example',
  size: '51–200 employees',
  description:
    'We’re a small, ambitious team building thoughtful software for modern businesses. We believe great work happens when talented people have the space to make an impact.',
}
