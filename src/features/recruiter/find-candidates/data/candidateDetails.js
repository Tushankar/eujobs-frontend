/*
 * Profile detail for each candidate in `candidates.js` (same ids): the text shown on the Overview, Experience
 * and Education tabs and in the resume preview. Demo copy modelled on the Figma profile (Emma Wilson);
 * every candidate-provided claim is labelled as such in the UI.
 *
 * about       paragraph for "The person behind the profile"
 * roles       career history, newest first (the first entry is the current role); period is "start–end"
 * education   { degree, period }
 * potentialGap  one thing the profile does not confirm (shown as "Potential gap", never as missing ability)
 */
export const candidateDetails = {
  'emma-wilson': {
    about:
      'Emma is a senior product designer with 6 years of experience creating thoughtful digital products. Their recent work at Notion includes cross-functional collaboration and a focus on figma and product design.',
    roles: [
      { role: 'Senior Product Designer', org: 'Notion', period: '2022–present' },
      { role: 'Product Designer', org: 'Independent studio', period: '2019–2022' },
    ],
    education: { degree: 'Bachelor of Design', period: '2015–2019' },
    potentialGap: 'Enterprise SaaS experience not confirmed',
  },
  'oliver-park': {
    about:
      'Oliver is a lead product designer with 9 years of experience creating thoughtful digital products. Their recent work at Vercel includes cross-functional collaboration and a focus on figma and leadership.',
    roles: [
      { role: 'Lead Product Designer', org: 'Vercel', period: '2021–present' },
      { role: 'Senior Product Designer', org: 'Design agency', period: '2017–2021' },
    ],
    education: { degree: 'Master of Design', period: '2013–2015' },
    potentialGap: 'Hands-on mobile experience not confirmed',
  },
  'james-chen': {
    about:
      'James is a senior product designer with 7 years of experience creating thoughtful digital products. Their recent work at Stripe includes cross-functional collaboration and a focus on figma and design systems.',
    roles: [
      { role: 'Senior Product Designer', org: 'Stripe', period: '2022–present' },
      { role: 'Product Designer', org: 'Freelance', period: '2019–2022' },
    ],
    education: { degree: 'Bachelor of Fine Arts', period: '2014–2018' },
    potentialGap: 'Consumer product experience not confirmed',
  },
  'sofia-martinez': {
    about:
      'Sofia is a product designer with 4 years of experience creating thoughtful digital products. Their recent work at Monzo includes cross-functional collaboration and a focus on figma and ux research.',
    roles: [
      { role: 'Product Designer', org: 'Monzo', period: '2023–present' },
      { role: 'Junior Designer', org: 'Digital studio', period: '2022–2023' },
    ],
    education: { degree: 'Bachelor of Arts in Design', period: '2018–2022' },
    potentialGap: 'Leading a design project end to end not confirmed',
  },
  'daniel-kim': {
    about:
      'Daniel is a product designer with 3 years of experience creating thoughtful digital products. Their recent work at Dropbox includes cross-functional collaboration and a focus on figma and prototyping.',
    roles: [
      { role: 'Product Designer', org: 'Dropbox', period: '2024–present' },
      { role: 'Associate Designer', org: 'Early-stage startup', period: '2023–2024' },
    ],
    education: { degree: 'Bachelor of Design', period: '2019–2023' },
    potentialGap: 'Team leadership experience not confirmed',
  },
  'aisha-patel': {
    about:
      'Aisha is a UX researcher with 5 years of experience creating thoughtful digital products. Their recent work at Spotify includes cross-functional collaboration and a focus on ux research and user interviews.',
    roles: [
      { role: 'UX Researcher', org: 'Spotify', period: '2022–present' },
      { role: 'Research Associate', org: 'University research lab', period: '2020–2022' },
    ],
    education: { degree: 'Master of Science in Human-Computer Interaction', period: '2018–2020' },
    potentialGap: 'Design tooling experience not confirmed',
  },
}
