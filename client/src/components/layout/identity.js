/** M-195: the line under the name — the candidate's plan, the recruiter's company, the admin's role (or Owner). */
export function identitySubtitle(me, t) {
  if (me.role === 'candidate') return t(`enums:planKey.${me.plan}`)
  if (me.role === 'recruiter') return me.company?.displayName ?? ''
  if (me.isOwner) return t('shell:identity.owner')
  return me.adminRole?.name ?? t('shell:identity.noRole')
}
