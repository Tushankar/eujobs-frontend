import { interpolate, t } from '../lib/i18n.js'

/*
 * Sample parameters for every email type (npm run mail:test, and the P11-04 browser check that renders each email
 * in Spanish and French). `origin` is the client origin the links point to. Values a server task translates (the
 * check, the CV-request reason, statuses and counts) come in the recipient's language, as the tasks send them.
 */
export function mailSample(type, language, origin) {
  const SAMPLE_PARAMS = {
    verify_email: { link: `${origin}/verify-email?token=mail-test` },
    already_registered: { link: `${origin}/sign-in`, secondaryLink: `${origin}/forgot-password` },
    recruiter_email_code: { code: '123456' },
    password_reset: { link: `${origin}/reset-password?token=mail-test` },
    admin_invite: { inviter: 'Workspace admin', role: 'Staff', link: `${origin}/admin/set-password?token=mail-test` },
    verification_approved: { link: `${origin}/candidate/verification` },
    verification_rejected: { reason: 'The photo page is not readable.', link: `${origin}/candidate/verification` },
    recruiter_approved: { company: 'Mail Test Ltd', link: `${origin}/recruiter/sign-in` },
    recruiter_rejected: { company: 'Mail Test Ltd', reason: 'The registration document is not readable.', link: `${origin}/recruiter/onboarding/review` },
    recruiter_suspended: { company: 'Mail Test Ltd', reason: 'Jobs on this account broke the posting rules.', link: `${origin}/recruiter/onboarding/review` },
    content_restricted: {
      summary: 'An administrator reviewed your job “Senior Product Designer” and restricted it. It is paused and cannot be published again while the restriction applies.',
      reason: 'The salary range does not match the role description.',
      photoNote: '',
      link: `${origin}/recruiter/jobs`,
    },
    content_restriction_lifted: {
      summary: 'The restriction on your job “Senior Product Designer” was lifted. It stays paused until you publish it again.',
      link: `${origin}/recruiter/jobs`,
    },
    cv_request: { company: 'Mail Test Ltd', details: 'We would like to see the CV you used for your 2023 role.', link: `${origin}/candidate/cv-versions` },
    renewal_failed: { plan: 'Plus', amount: '£9', link: `${origin}/candidate/settings/billing` },
    certificate_issued: {
      course: 'Interaction design foundations',
      code: 'LWM-7K3P-Q9XD',
      link: `${origin}/candidate/learning`,
      secondaryLink: `${origin}/certificates/LWM-7K3P-Q9XD`,
    },
    plan_ended: { plan: 'Plus', link: `${origin}/candidate/settings/billing` },
    application_status: { job: 'Senior Product Designer', company: 'Mail Test Ltd', link: `${origin}/candidate/applications` },
    application_rejected: { job: 'Senior Product Designer', company: 'Mail Test Ltd', link: `${origin}/candidate/jobs` },
    new_applications: { job: 'Senior Product Designer', link: `${origin}/recruiter/applications` },
    new_message: { sender: 'Mail Test Ltd', link: `${origin}/candidate/messages` },
    alert_instant: {
      alertName: 'Product design roles',
      job: 'Senior Product Designer',
      items: ['Senior Product Designer · Mail Test Ltd · London'],
      link: `${origin}/candidate/jobs`,
      secondaryLink: `${origin}/candidate/job-alerts`,
    },
    alert_daily: {
      alertName: 'Product design roles',
      items: ['Senior Product Designer · Mail Test Ltd · London', 'UX Designer · Mail Test Ltd · Dublin'],
      link: `${origin}/candidate/jobs`,
      secondaryLink: `${origin}/candidate/job-alerts`,
    },
  }
  SAMPLE_PARAMS.alert_weekly = SAMPLE_PARAMS.alert_daily
  // Verification emails name the check in the recipient's language, as the decision does.
  const check = type.startsWith('verification_') ? { check: t(language, 'verification.category.identity') } : {}
  // So does the reason a recruiter picked for a CV request.
  const reason = type === 'cv_request' ? { reason: t(language, 'cvRequestReason.verify_employment') } : {}
  // Application emails carry the status, the next step and the count in the recipient's language, as the tasks do.
  const application =
    type === 'application_status'
      ? { status: t(language, 'labels.applicationStatus.interview'), nextStep: t(language, 'labels.nextStep.interview') }
      : type === 'new_applications'
        ? { countLabel: interpolate(t(language, 'labels.newApplications.other'), { count: 2 }) }
        : type.startsWith('alert_')
          ? { countLabel: interpolate(t(language, 'labels.alertJobs.other'), { count: 2 }) }
          : {}
  return SAMPLE_PARAMS[type] && { name: 'Mail test', ...check, ...reason, ...application, ...SAMPLE_PARAMS[type] }
}
