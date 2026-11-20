/** True when the user is on a paid plan (candidate Plus, Recruiter Plus, Agency Plus). */
export const isPaidPlan = (me) => ['plus', 'recruiter_plus', 'agency_plus'].includes(me?.plan)
