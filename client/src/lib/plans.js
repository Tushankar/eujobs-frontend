/** True when the user is on a paid plan (candidate Plus, Recruiter Plus). */
export const isPaidPlan = (me) => me?.plan === 'plus' || me?.plan === 'recruiter_plus'
