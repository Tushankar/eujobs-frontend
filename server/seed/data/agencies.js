/*
 * 2026-11-26 (owner): two seeded agencies, for seed:demo and the live database (scripts/addSectorJobs.js). Northbridge
 * Staffing is a demo account (Priya, a plus-alias of SEED_ADMIN_EMAIL, so it can sign in); Atlas Interim's contact is
 * on example.com. Each has clients (some linked to a seeded employer), a published agreement (its PDF holds every
 * clause word for word), agency jobs, seeded candidates on its books and two placements: one running, one upcoming.
 * Dates are days from the seed run; rates are in the job country's currency (remote jobs: `currency`).
 */

/** An agency job: the JOBS fields plus its terms. `client` is a client key; `closed` jobs were filled (a running placement). */
const agencyJob = ({ client, showClient = true, title, type = 'full_time', sector, brief, does, skills, nice = [], level, years, mode, city, startInDays, weeks, rate, hoursPerWeek, hoursAgo, closed = false, languages = [] }) => ({
  client,
  showClient,
  title,
  employmentType: type,
  sector,
  brief,
  responsibilities: does,
  requiredSkills: skills,
  preferredSkills: nice,
  level,
  experienceYears: years,
  workPreference: mode,
  city: mode === 'remote' ? 'remote' : city,
  requiredLanguages: languages.map(([code, minLevel]) => ({ code, minLevel })),
  startInDays,
  weeks,
  rate,
  hoursPerWeek,
  hoursAgo,
  closed,
})

export const AGENCIES = [
  {
    key: 'northbridge',
    recruiter: { tag: 'priya' },
    name: 'Northbridge Staffing',
    legalName: 'Northbridge Staffing Ltd',
    sector: 'hr_recruitment',
    size: '11_50',
    city: 'manchester',
    currency: 'GBP',
    approvedDaysAgo: 60,
    description: 'A Manchester staffing agency placing nurses, care staff, warehouse and events teams, and digital contractors with employers across the North West and remotely.',
    clients: [
      { key: 'harbourview', name: 'Harbourview Health', sector: 'healthcare', city: 'manchester', linked: 'harbourview' },
      { key: 'pennine', name: 'Pennine Distribution', sector: 'logistics_transport', city: 'manchester' },
      { key: 'riverside', name: 'Riverside Events Co.', sector: 'hospitality_tourism', city: 'manchester' },
      { key: 'halden', name: 'Halden Digital', sector: 'it_software', city: 'london' },
    ],
    agreement: {
      fileName: 'Northbridge-candidate-agreement-v1.pdf',
      publishedDaysAgo: 45,
      rules: {
        exclusivity: ['no_other_agency_work', 'While an assignment is running, the Candidate will not take up work offered through another employment agency.'],
        noticeDays: [7, "Either party may end an assignment early by giving 7 days' written notice."],
        coolingOffDays: [30, 'For 30 days after an assignment ends, the Candidate will not work for the same client through anyone other than Northbridge Staffing.'],
        maxWeeklyHours: [48, 'The Candidate will not be asked to work more than 48 hours in any week across all assignments.'],
      },
    },
    jobs: [
      agencyJob({
        client: 'harbourview', title: 'Agency Nurse, Acute Medicine', sector: 'healthcare', level: 'mid', years: 2, mode: 'on_site', city: 'manchester', startInDays: 10, weeks: 12, rate: [32, 'hour'], hoursPerWeek: 37, hoursAgo: 70,
        brief: 'Cover a twelve-week block on an acute medical ward while the hospital recruits permanent staff. Day and night shifts are booked in advance, and you will get a full ward induction on your first shift.',
        does: ['Assess and care for a group of acute medical patients each shift', 'Give medicines safely and keep accurate records', 'Hand over clearly to the next shift'],
        skills: ['Registered Nurse', 'Patient Assessment', 'Medication Administration'], nice: ['IV Therapy'],
      }),
      agencyJob({
        client: 'harbourview', title: 'Healthcare Assistant, Nights', type: 'part_time', sector: 'healthcare', level: 'junior', years: 1, mode: 'on_site', city: 'manchester', startInDays: 7, weeks: 8, rate: [13.5, 'hour'], hoursPerWeek: 24, hoursAgo: 26,
        brief: 'Two night shifts a week on a medical ward for eight weeks. You will help patients with personal care and comfort overnight and support the nurses with observations.',
        does: ['Help patients with personal care through the night', 'Take and record observations', 'Keep the ward calm, safe and tidy'],
        skills: ['Patient Care', 'Observations', 'Teamwork'],
      }),
      agencyJob({
        client: 'pennine', title: 'Warehouse Operative', sector: 'logistics_transport', level: 'junior', years: 0, mode: 'on_site', city: 'manchester', startInDays: 5, weeks: 6, rate: [12.8, 'hour'], hoursPerWeek: 40, hoursAgo: 50,
        brief: 'Pick, pack and load orders at a busy distribution centre in Trafford Park during the run-up to the holidays. Full training and safety boots provided; overtime available most weeks.',
        does: ['Pick and pack orders accurately with a handheld scanner', 'Load and unload deliveries safely', 'Keep your work area clean and organised'],
        skills: ['Picking and Packing', 'Manual Handling', 'Reliability'], nice: ['Forklift Licence'],
      }),
      agencyJob({
        client: 'riverside', title: 'Event Bar Staff', type: 'part_time', sector: 'hospitality_tourism', level: 'junior', years: 0, mode: 'on_site', city: 'manchester', startInDays: 14, weeks: 4, rate: [13, 'hour'], hoursPerWeek: 16, hoursAgo: 96,
        brief: 'Serve drinks at concerts and conferences across Manchester over four busy weeks. Evening and weekend shifts, team briefings before every event and a friendly crew to work with.',
        does: ['Serve drinks quickly and check ID where needed', 'Handle card and cash payments', 'Restock and clean the bar during and after events'],
        skills: ['Customer Service', 'Cash Handling', 'Teamwork'],
      }),
      agencyJob({
        client: 'pennine', showClient: false, title: 'HR Administrator', sector: 'hr_recruitment', level: 'junior', years: 1, mode: 'hybrid', city: 'manchester', startInDays: 21, weeks: 10, rate: [15, 'hour'], hoursPerWeek: 37, hoursAgo: 140,
        brief: 'Support a busy HR team through a ten-week cover while they move to a new HR system. You will keep employee records accurate, prepare contracts and answer everyday HR questions.',
        does: ['Keep employee records up to date in the HR system', 'Prepare contracts, letters and onboarding packs', 'Answer staff questions by phone and email'],
        skills: ['HR Administration', 'Data Entry', 'Microsoft Office'], nice: ['CIPD Level 3'],
      }),
      agencyJob({
        client: 'halden', title: 'Interim Lead Product Designer', sector: 'it_software', level: 'lead', years: 8, mode: 'remote', startInDays: -14, weeks: 10, rate: [550, 'day'], hoursAgo: 26 * 24, closed: true,
        brief: 'Lead product design for a client’s customer platform for ten weeks while they hire a permanent head of design. You will run the design team’s rituals, set direction and ship the next release.',
        does: ['Lead a team of three product designers day to day', 'Set design direction for the next platform release', 'Run critiques and keep the design system consistent'],
        skills: ['Product Design', 'Leadership', 'Design Systems', 'Figma'],
      }),
      agencyJob({
        client: 'halden', showClient: false, title: 'Contract Senior Product Designer', sector: 'it_software', level: 'senior', years: 5, mode: 'remote', startInDays: 9, weeks: 12, rate: [475, 'day'], hoursAgo: 9 * 24,
        brief: 'A twelve-week contract designing a new self-service portal for a client in financial services. You will work with a product manager and four engineers, from research through to developer handover.',
        does: ['Design and prototype the portal’s key journeys', 'Test designs with customers and iterate', 'Prepare clear specifications for engineering'],
        skills: ['Product Design', 'Figma', 'Prototyping', 'UX Research'],
      }),
    ],
    // On the books: Oliver (asked, agreed) and Emma (invited, agreed); Aisha asked yesterday; James was invited and has not agreed yet.
    books: [
      { person: 'Oliver Park', by: 'candidate', startedDaysAgo: 32, agreedDaysAgo: 30 },
      { person: 'Emma Wilson', by: 'agency', startedDaysAgo: 9, agreedDaysAgo: 8 },
      { person: 'Aisha Patel', by: 'candidate', startedDaysAgo: 1 },
      { person: 'James Chen', by: 'agency', startedDaysAgo: 2 },
    ],
    // `path`: the stages after Applied, one a day.
    placements: [
      { person: 'Oliver Park', job: 'Interim Lead Product Designer', appliedDaysAgo: 24, path: ['screening', 'interview', 'offer', 'hired'] },
      { person: 'Emma Wilson', job: 'Contract Senior Product Designer', appliedDaysAgo: 7, path: ['screening', 'interview', 'hired'] },
    ],
  },
  {
    key: 'atlas',
    recruiter: { fullName: 'Jonas Weber', email: 'jonas.weber@example.com', jobTitle: 'Managing director' },
    name: 'Atlas Interim',
    legalName: 'Atlas Interim GmbH',
    sector: 'hr_recruitment',
    size: '11_50',
    city: 'berlin',
    currency: 'EUR',
    approvedDaysAgo: 90,
    description: 'Interim engineers, site supervisors, finance professionals and designers for companies across Germany, on contracts from a few weeks to a year.',
    clients: [
      { key: 'arcwell', name: 'Arcwell Engineering', sector: 'engineering', city: 'munich', linked: 'arcwell' },
      { key: 'brandt', name: 'Brandt & Sohn Bau', sector: 'construction_trades', city: 'berlin', linked: 'brandt' },
      { key: 'hansa', name: 'Hansa Retail Group', sector: 'retail_ecommerce', city: 'berlin' },
      { key: 'nordlicht', name: 'Studio Nordlicht', sector: 'marketing_media', city: 'berlin' },
    ],
    agreement: {
      fileName: 'Atlas-Interim-candidate-agreement-v1.pdf',
      publishedDaysAgo: 80,
      rules: {
        exclusivity: ['no_same_client', 'During an assignment the Candidate may take other work, but not for the same client through another agency.'],
        noticeDays: [14, "Either party may end an assignment early by giving 14 days' written notice."],
      },
    },
    jobs: [
      agencyJob({
        client: 'arcwell', title: 'Interim Mechanical Engineer', sector: 'engineering', level: 'senior', years: 6, mode: 'hybrid', city: 'munich', startInDays: 12, weeks: 16, rate: [560, 'day'], hoursAgo: 30, languages: [['de', 'b2']],
        brief: 'Join a test rig project for sixteen weeks to cover peak design work. You will design assemblies, check calculations and support the workshop through build, with two office days a week in Munich.',
        does: ['Design mechanical assemblies in CAD', 'Check load calculations and select components', 'Support the workshop during build'],
        skills: ['Mechanical Design', 'CAD', 'Engineering Calculations'], nice: ['SolidWorks'],
      }),
      agencyJob({
        client: 'brandt', title: 'Site Supervisor', sector: 'construction_trades', level: 'mid', years: 4, mode: 'on_site', city: 'berlin', startInDays: 8, weeks: 10, rate: [38, 'hour'], hoursPerWeek: 45, hoursAgo: 60, languages: [['de', 'c1']],
        brief: 'Supervise the fit-out phase of a school refurbishment in Berlin for ten weeks. You will coordinate trades on site, run daily safety briefings and keep the site diary up to date.',
        does: ['Coordinate trades and deliveries on site', 'Run daily safety briefings and checks', 'Keep the site diary and progress photos up to date'],
        skills: ['Site Supervision', 'Health and Safety', 'Construction Planning'],
      }),
      agencyJob({
        client: 'hansa', title: 'Seasonal Sales Assistant', type: 'part_time', sector: 'retail_ecommerce', level: 'junior', years: 0, mode: 'on_site', city: 'berlin', startInDays: 4, weeks: 6, rate: [14.5, 'hour'], hoursPerWeek: 20, hoursAgo: 18, languages: [['de', 'b1']],
        brief: 'Help customers find the right gifts in a busy department store over the holiday season. Flexible part-time shifts, staff discount and a short training day before you start.',
        does: ['Help customers on the shop floor', 'Work the till and handle returns', 'Keep shelves stocked and tidy'],
        skills: ['Customer Service', 'Sales', 'Cash Handling'],
      }),
      agencyJob({
        client: 'hansa', showClient: false, title: 'Interim Finance Controller', sector: 'finance_economics', level: 'senior', years: 7, mode: 'hybrid', city: 'berlin', startInDays: 30, weeks: 20, rate: [650, 'day'], hoursAgo: 120, languages: [['de', 'c1'], ['en', 'b2']],
        brief: 'Run month-end and year-end close for a retail group during a twenty-week cover. You will lead a small finance team, prepare management reports and work with the auditors.',
        does: ['Lead month-end and year-end close', 'Prepare management accounts and forecasts', 'Work with auditors and tax advisers'],
        skills: ['Financial Reporting', 'Management Accounting', 'HGB', 'Team Leadership'], nice: ['SAP'],
      }),
      agencyJob({
        client: 'nordlicht', title: 'Interim UX Researcher', sector: 'it_software', level: 'mid', years: 3, mode: 'remote', startInDays: -10, weeks: 8, rate: [430, 'day'], hoursAgo: 25 * 24, closed: true,
        brief: 'Run an eight-week research sprint for a design studio’s client, a public transport app. You will plan studies, interview riders and turn findings into clear recommendations.',
        does: ['Plan and run interviews and usability tests', 'Synthesise findings into insights and recommendations', 'Present results to the client team'],
        skills: ['UX Research', 'User Interviews', 'Usability Testing'],
      }),
      agencyJob({
        client: 'nordlicht', showClient: false, title: 'Contract Interaction Designer', sector: 'it_software', level: 'mid', years: 4, mode: 'remote', startInDays: 16, weeks: 12, rate: [460, 'day'], hoursAgo: 8 * 24,
        brief: 'A twelve-week contract designing the interactions and motion for a new mobile banking app. You will work closely with the studio’s design lead and the client’s engineers.',
        does: ['Design interactions and micro-animations for key flows', 'Prototype and test ideas with users', 'Document patterns for the engineering team'],
        skills: ['Interaction Design', 'Prototyping', 'Figma', 'Motion Design'],
      }),
    ],
    books: [
      { person: 'Sofia Martinez', by: 'candidate', startedDaysAgo: 40, agreedDaysAgo: 39 },
      { person: 'Daniel Kim', by: 'agency', startedDaysAgo: 22, agreedDaysAgo: 20 },
    ],
    placements: [
      { person: 'Sofia Martinez', job: 'Interim UX Researcher', appliedDaysAgo: 22, path: ['screening', 'interview', 'hired'] },
      { person: 'Daniel Kim', job: 'Contract Interaction Designer', appliedDaysAgo: 5, path: ['screening', 'shortlisted', 'hired'] },
    ],
  },
]
