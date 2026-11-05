// TEMPORARY: screenshots the restyled skills, eligibility and applicants area of the recruiter job page. Deleted after the run.
import { signInWithForm } from '../lib/flows.js'
import { approvedRecruiter, jobBody, login, postJob } from '../lib/recruiters.js'
import { TEST_PASSWORD } from '../lib/testApi.js'

export default {
  name: 'TMP Job skills area',
  viewports: ['D'],
  async run(ctx) {
    const recruiter = await approvedRecruiter('Skills')
    const token = await login(recruiter.email)
    const job = await postJob(
      token,
      jobBody({
        title: 'Full Stack Developer',
        requiredSkills: ['React', 'Node.js', 'MongoDB', 'AWS', 'TypeScript', 'Express.js', 'REST APIs', 'Git'],
        preferredSkills: ['Docker', 'Terraform', 'Next.js', 'CI/CD', 'GraphQL', 'Redux', 'Jest'],
        workPreference: 'remote',
        placeId: null,
        remoteCountries: ['DE', 'FR', 'NL'],
        visaSponsorship: true,
      }),
    )
    const handle = await ctx.newPage()
    const { page } = handle
    await signInWithForm(page, ctx.webUrl, '/recruiter/sign-in', recruiter.email, TEST_PASSWORD)
    await page.goto(`${ctx.webUrl}/recruiter/jobs/${job.id}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-job-applicants] p, [data-job-applicants] ul', { visible: true })
    await ctx.screenshot(page, '0-top')
    await page.evaluate(() => document.querySelector('[data-job-applicants]').scrollIntoView({ block: 'center' }))
    await new Promise((resolve) => setTimeout(resolve, 300))
    await ctx.screenshot(page, '1-skills')
    const text = await page.evaluate(() => document.querySelector('#brief-title').closest('section').innerText)
    ctx.check(text.includes('Eligibility') && text.includes('Visa sponsorship available'), 'eligibility heading and visa line show')
    ctx.assertClean(handle.issues, 'job skills area')
  },
}
