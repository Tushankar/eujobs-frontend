/*
 * Messages and job alerts for seed:demo (Phase 7 task 6). The mock outreach was device-only and empty, so the
 * threads are the owner's choice (P7-Q3): two Acme threads, dated days ago so no email is scheduled. `daysAgo` dates
 * each message; `read` marks it read by the other side. The two alerts of the candidate mock belong to Emma (P7-Q4),
 * with no city; the remote one uses the Remote view, where remote jobs are listed.
 */
export const THREADS = [
  {
    person: 'Emma Wilson',
    job: 'Senior Product Designer',
    messages: [
      {
        from: 'recruiter',
        daysAgo: 5,
        read: true,
        body: 'Hi Emma, thanks for applying for our Senior Product Designer role. Your design systems work stood out to us. Would you be open to a short call this week to talk about the team?',
      },
      {
        from: 'candidate',
        daysAgo: 4,
        read: false,
        body: 'Hi Sarah, thank you for reaching out. I would be glad to talk. I am free on Thursday or Friday afternoon, UK time.',
      },
    ],
  },
  {
    person: 'Oliver Park',
    job: 'Senior UX Designer',
    messages: [
      {
        from: 'recruiter',
        daysAgo: 2,
        read: false,
        body: 'Hi Oliver, we enjoyed your interview for the Senior UX Designer role. Could you share two or three examples of research you led end to end before our next conversation?',
      },
    ],
  },
]

export const ALERTS = [
  { person: 'Emma Wilson', name: 'Remote product design roles', keywords: 'remote product design', frequency: 'daily', country: 'REMOTE' },
  { person: 'Emma Wilson', name: 'Senior design roles in fintech', keywords: 'senior design fintech', frequency: 'weekly', country: 'GB' },
]
