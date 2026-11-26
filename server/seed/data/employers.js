/*
 * 2026-11-26 (owner): more sector jobs for seed:demo and the live database (scripts/addSectorJobs.js): 42 fictional
 * employers on example.com, one job each, so every sector has at least three jobs (Acme, on Recruiter Plus, gets an
 * intern too). Without Recruiter Plus a company keeps only its newest job live (enforceFreeJobLimit, P11c-Q12), hence one
 * job per employer. A sector is the kind of work, not the employer's industry. The employers and their people are
 * invented; their logos are original (seed/assets/logos). Pay is in the city's currency (remote: EUR); part-time and
 * internship pay is monthly; volunteer roles are unpaid.
 */

/** The currency of each seed city (PLACES) and of remote jobs. */
export const CITY_CURRENCY = {
  london: 'GBP',
  manchester: 'GBP',
  dublin: 'EUR',
  berlin: 'EUR',
  munich: 'EUR',
  paris: 'EUR',
  lyon: 'EUR',
  madrid: 'EUR',
  barcelona: 'EUR',
  amsterdam: 'EUR',
  lisbon: 'EUR',
  warsaw: 'PLN',
  stockholm: 'SEK',
  remote: 'EUR',
}

const pay = (city, min, max, period = 'year') => ({ min, max, currency: CITY_CURRENCY[city], period })

/** The new employers, in the COMPANIES shape (recruiters.js); each recruiter is on example.com (OD9). */
export const EMPLOYERS = [
  { key: 'harbourview', recruiter: { fullName: 'Grace Okafor', email: 'grace.okafor@example.com' }, name: 'Harbourview Health', legalName: 'Harbourview Health Group Ltd', sector: 'healthcare', size: '1000_plus', city: 'manchester', description: 'A group of community hospitals and clinics across the North West, caring for patients close to home and training the next generation of clinicians.' },
  { key: 'brandt', recruiter: { fullName: 'Felix Brandt', email: 'felix.brandt@example.com' }, name: 'Brandt & Sohn Bau', legalName: 'Brandt & Sohn Bau GmbH', sector: 'construction_trades', size: '201_500', city: 'berlin', description: 'A family-run building contractor delivering housing, schools and refurbishment projects across Berlin and Brandenburg since 1968.' },
  { key: 'northfield', recruiter: { fullName: 'Laura Puig', email: 'laura.puig@example.com' }, name: 'Northfield International School', sector: 'education', size: '51_200', city: 'barcelona', description: 'An English-language international school for pupils aged 3 to 18, with small classes and a strong bilingual community.' },
  { key: 'commonground', recruiter: { fullName: 'Chloé Bernard', email: 'chloe.bernard@example.com' }, name: 'Common Ground Foundation', sector: 'charity_nonprofit', size: '11_50', city: 'lyon', description: 'A non-profit running food banks, language cafés and job clubs for families in the Lyon area, powered by staff and volunteers.' },
  { key: 'casabrava', recruiter: { fullName: 'Diego Navarro', email: 'diego.navarro@example.com' }, name: 'Casa Brava Arts Centre', sector: 'arts_culture', size: '51_200', city: 'madrid', description: 'A contemporary arts centre with galleries, a performance hall and a summer festival that brings new artists to Madrid audiences.' },
  { key: 'valemont', recruiter: { fullName: 'Hannah Price', email: 'hannah.price@example.com' }, name: 'Valemont District Council', sector: 'public_sector', size: '501_1000', city: 'manchester', description: 'The local authority for the Valemont district, responsible for housing, planning, parks and community services for 180,000 residents.' },
  { key: 'marisol', recruiter: { fullName: 'Rita Almeida', email: 'rita.almeida@example.com' }, name: 'Marisol Hotel Group', sector: 'hospitality_tourism', size: '201_500', city: 'lisbon', description: 'Independent boutique hotels on the Lisbon coast, known for warm service, local food and long-serving teams.' },
  { key: 'vistula', recruiter: { fullName: 'Marek Kowalski', email: 'marek.kowalski@example.com' }, name: 'Vistula Freight', legalName: 'Vistula Freight Sp. z o.o.', sector: 'logistics_transport', size: '201_500', city: 'warsaw', description: 'Road freight and warehousing across Poland and Central Europe, with a modern fleet and a planning team that runs around the clock.' },
  { key: 'harcourt', recruiter: { fullName: 'Edward Vale', email: 'edward.vale@example.com' }, name: 'Harcourt & Vale', legalName: 'Harcourt & Vale LLP', sector: 'legal', size: '51_200', city: 'london', description: 'A commercial law firm advising technology, media and growing businesses on contracts, disputes and regulation.' },
  { key: 'keystone', recruiter: { fullName: 'Ciara Byrne', email: 'ciara.byrne@example.com' }, name: 'Keystone Property Partners', sector: 'real_estate', size: '11_50', city: 'dublin', description: 'Residential lettings and property management for landlords and tenants across Dublin, with a focus on clear, fair service.' },
  { key: 'lindqvist', recruiter: { fullName: 'Astrid Lindqvist', email: 'astrid.lindqvist@example.com' }, name: 'Lindqvist Research Institute', sector: 'science_research', size: '51_200', city: 'stockholm', description: 'An independent research institute studying climate, oceans and environmental chemistry, funded by public and foundation grants.' },
  { key: 'arcwell', recruiter: { fullName: 'Stefan Huber', email: 'stefan.huber@example.com' }, name: 'Arcwell Engineering', legalName: 'Arcwell Engineering GmbH', sector: 'engineering', size: '201_500', city: 'munich', description: 'Designs and builds test rigs and automation systems for the automotive and energy industries, from concept to commissioning.' },
  // Without Recruiter Plus a company keeps one live job (enforceFreeJobLimit), so every other job has its own employer.
  { key: 'brightwire', recruiter: { fullName: 'Niamh Doyle', email: 'niamh.doyle@example.com' }, name: 'Brightwire Software', sector: 'it_software', size: '51_200', city: 'dublin', description: 'Planning and issue tracking software for product teams, built in Dublin and used by thousands of software companies.' },
  { key: 'tessel', recruiter: { fullName: 'Sanne de Vries', email: 'sanne.devries@example.com' }, name: 'Tessel Cloud', legalName: 'Tessel Cloud B.V.', sector: 'it_software', size: '201_500', city: 'amsterdam', description: 'A shared workspace for notes and documents, hosted entirely in the EU and used by millions of people.' },
  { key: 'clearwater', recruiter: { fullName: 'Aoife Murphy', email: 'aoife.murphy@example.com' }, name: 'Clearwater Payments', sector: 'finance_economics', size: '201_500', city: 'dublin', description: 'Card and online payments for small and medium-sized merchants across Europe.' },
  { key: 'northlink', recruiter: { fullName: 'Conor Walsh', email: 'conor.walsh@example.com' }, name: 'Northlink Pay', sector: 'finance_economics', size: '501_1000', city: 'dublin', description: 'Payment accounts, cards and transfers for growing online businesses, licensed in Ireland and live in 20 EU countries.' },
  { key: 'sketchbook', recruiter: { fullName: 'Olivia Hart', email: 'olivia.hart@example.com' }, name: 'Sketchbook Learning', sector: 'education', size: '51_200', city: 'london', description: 'Design software and courses for schools and universities, used by students in 30 countries.' },
  { key: 'stackyard', recruiter: { fullName: 'Jan Schulz', email: 'jan.schulz@example.com' }, name: 'Stackyard', legalName: 'Stackyard GmbH', sector: 'it_software', size: '51_200', city: 'berlin', description: 'An open-source deployment platform that helps developers ship web apps to any cloud.' },
  { key: 'nordsound', recruiter: { fullName: 'Elin Berg', email: 'elin.berg@example.com' }, name: 'Nordsound', legalName: 'Nordsound AB', sector: 'marketing_media', size: '201_500', city: 'stockholm', description: 'A Nordic music streaming and radio service with editorial playlists curated in Stockholm, Oslo and Copenhagen.' },
  { key: 'fjord', recruiter: { fullName: 'Oskar Nilsson', email: 'oskar.nilsson@example.com' }, name: 'Fjord Games', legalName: 'Fjord Games AB', sector: 'it_software', size: '201_500', city: 'stockholm', description: 'An independent games studio making cosy co-op games played by millions on console and PC.' },
  { key: 'lojista', recruiter: { fullName: 'Tiago Pereira', email: 'tiago.pereira@example.com' }, name: 'Lojista Commerce', sector: 'retail_ecommerce', size: '51_200', city: 'lisbon', description: 'Online shop software for independent retailers in Portugal and Spain, from first sale to multi-store chains.' },
  { key: 'mercado', recruiter: { fullName: 'Beatriz Santos', email: 'beatriz.santos@example.com' }, name: 'Mercado Azul', sector: 'retail_ecommerce', size: '11_50', city: 'lisbon', description: 'An online marketplace where independent Iberian makers run their own shops, from ceramics to cork.' },
  { key: 'atelierpixel', recruiter: { fullName: 'Julien Moreau', email: 'julien.moreau@example.com' }, name: 'Atelier Pixel', sector: 'marketing_media', size: '51_200', city: 'paris', description: 'A photo and video editing app for creators, with a large French-speaking community.' },
  { key: 'maisonverte', recruiter: { fullName: 'Léa Dubois', email: 'lea.dubois@example.com' }, name: 'Maison Verte', sector: 'retail_ecommerce', size: '51_200', city: 'paris', description: 'Natural skincare made in France, sold online and in 40 partner shops.' },
  { key: 'thameside', recruiter: { fullName: 'Samuel Okoye', email: 'samuel.okoye@example.com' }, name: 'Thameside Credit Union', sector: 'finance_economics', size: '51_200', city: 'london', description: 'A member-owned credit union offering fair savings, loans and overdrafts to people who live or work in East London.' },
  { key: 'ferro', recruiter: { fullName: 'Amelia Grant', email: 'amelia.grant@example.com' }, name: 'Ferro Bank', sector: 'finance_economics', size: '501_1000', city: 'london', description: 'A digital bank for freelancers and small businesses, with engineering and design teams in London.' },
  { key: 'oakwood', recruiter: { fullName: 'Joanne Ellis', email: 'joanne.ellis@example.com' }, name: 'Oakwood Care', sector: 'healthcare', size: '201_500', city: 'manchester', description: 'Community hospitals and care homes for older people across Greater Manchester.' },
  { key: 'nwtrials', recruiter: { fullName: 'Kwame Mensah', email: 'kwame.mensah@example.com' }, name: 'North West Clinical Trials Unit', sector: 'science_research', size: '51_200', city: 'manchester', description: 'Runs clinical trials for new treatments with hospitals and universities across the North West.' },
  { key: 'spreeelektro', recruiter: { fullName: 'Tobias Krüger', email: 'tobias.krueger@example.com' }, name: 'Spree Elektro', legalName: 'Spree Elektro GmbH', sector: 'construction_trades', size: '11_50', city: 'berlin', description: 'Electrical contractors for new homes, schools and refurbishments across Berlin.' },
  { key: 'llegimjunts', recruiter: { fullName: 'Marta Soler', email: 'marta.soler@example.com' }, name: 'Llegim Junts', sector: 'education', size: '1_10', city: 'barcelona', description: 'A literacy charity that brings trained volunteers into Barcelona primary schools to read with children.' },
  { key: 'rhonewelcome', recruiter: { fullName: 'Inès Faure', email: 'ines.faure@example.com' }, name: 'Rhône Welcome', sector: 'charity_nonprofit', size: '11_50', city: 'lyon', description: 'Language cafés and welcome desks for newcomers to Lyon, run by a small team and many volunteers.' },
  { key: 'paniersolidaire', recruiter: { fullName: 'Hugo Lefèvre', email: 'hugo.lefevre@example.com' }, name: 'Le Panier Solidaire', sector: 'charity_nonprofit', size: '1_10', city: 'lyon', description: 'A neighbourhood food bank in Lyon’s 8th arrondissement, open four days a week.' },
  { key: 'veranosonoro', recruiter: { fullName: 'Lucía Romero', email: 'lucia.romero@example.com' }, name: 'Verano Sonoro', sector: 'arts_culture', size: '11_50', city: 'madrid', description: 'A ten-day summer music and arts festival in Madrid parks, with free and ticketed events.' },
  { key: 'ashbyvale', recruiter: { fullName: 'Rachel Moore', email: 'rachel.moore@example.com' }, name: 'Ashby Vale Borough Council', sector: 'public_sector', size: '501_1000', city: 'manchester', description: 'The local authority for Ashby Vale, looking after planning, housing, roads and community services.' },
  { key: 'marrowdale', recruiter: { fullName: 'Ben Carter', email: 'ben.carter@example.com' }, name: 'Marrowdale District Council', sector: 'public_sector', size: '201_500', city: 'manchester', description: 'The district council for Marrowdale, with teams for housing, climate and communities.' },
  { key: 'tabernadocais', recruiter: { fullName: 'Miguel Sousa', email: 'miguel.sousa@example.com' }, name: 'Taberna do Cais', sector: 'hospitality_tourism', size: '11_50', city: 'lisbon', description: 'A 60-cover seafood restaurant on the Lisbon riverside, cooking with the day’s catch.' },
  { key: 'mazovia', recruiter: { fullName: 'Agnieszka Nowak', email: 'agnieszka.nowak@example.com' }, name: 'Mazovia Cold Chain', legalName: 'Mazovia Cold Chain Sp. z o.o.', sector: 'logistics_transport', size: '51_200', city: 'warsaw', description: 'Refrigerated transport and warehousing for food and pharmaceutical companies across Poland.' },
  { key: 'bramwell', recruiter: { fullName: 'Sophie Bramwell', email: 'sophie.bramwell@example.com' }, name: 'Bramwell Ross', legalName: 'Bramwell Ross LLP', sector: 'legal', size: '51_200', city: 'london', description: 'A London law firm for media, sport and entertainment clients, known for its trainee programme.' },
  { key: 'liffey', recruiter: { fullName: 'Seán Gallagher', email: 'sean.gallagher@example.com' }, name: 'Liffey Lettings', sector: 'real_estate', size: '11_50', city: 'dublin', description: 'A lettings agency matching tenants and landlords across Dublin city and county.' },
  { key: 'grafton', recruiter: { fullName: 'Emer Quinn', email: 'emer.quinn@example.com' }, name: 'Grafton Property Research', sector: 'real_estate', size: '11_50', city: 'dublin', description: 'Rent, yield and market research for residential landlords and investors in Ireland.' },
  { key: 'balticlab', recruiter: { fullName: 'Johan Ek', email: 'johan.ek@example.com' }, name: 'Baltic Marine Lab', sector: 'science_research', size: '11_50', city: 'stockholm', description: 'A small research lab studying water quality and sediment chemistry in the Baltic Sea.' },
  { key: 'isar', recruiter: { fullName: 'Lukas Maier', email: 'lukas.maier@example.com' }, name: 'Isar Automation', legalName: 'Isar Automation GmbH', sector: 'engineering', size: '51_200', city: 'munich', description: 'Controls and automation for battery and electric drive test lines.' },
  // Agriculture & Food, the 18th sector (owner 2026-11-26)
  { key: 'terraverde', recruiter: { fullName: 'Pablo Ortega', email: 'pablo.ortega@example.com' }, name: 'Terra Verde Farms', sector: 'agriculture_food', size: '51_200', city: 'madrid', description: 'Family-owned olive groves and vegetable farms in the Tagus valley, supplying supermarkets and restaurants across Spain.' },
  { key: 'polderfresh', recruiter: { fullName: 'Femke Bakker', email: 'femke.bakker@example.com' }, name: 'Polder Fresh', legalName: 'Polder Fresh B.V.', sector: 'agriculture_food', size: '201_500', city: 'amsterdam', description: 'Fresh salads, soups and ready meals made from Dutch-grown vegetables, sold in shops across the Benelux.' },
  { key: 'zlotyklos', recruiter: { fullName: 'Piotr Zieliński', email: 'piotr.zielinski@example.com' }, name: 'Złoty Kłos', legalName: 'Złoty Kłos Sp. z o.o.', sector: 'agriculture_food', size: '51_200', city: 'warsaw', description: 'A farmers’ cooperative growing grain and oilseed on 9,000 hectares around Warsaw, with its own storage and mill.' },
]

/** A job in the JOBS shape (recruiters.js). */
const job = ({ company, title, type = 'full_time', sector, brief, does, skills, nice = [], level, years, mode, city, salary, hoursAgo, languages = [], visa = false, remote = [] }) => ({
  company,
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
  ...(salary && { salary }),
  requiredLanguages: languages.map(([code, minLevel]) => ({ code, minLevel })),
  visaSponsorship: visa,
  remoteCountries: remote,
  hoursAgo,
})

export const SECTOR_JOBS = [
  /* ---------- Acme (Recruiter Plus), then one job per employer ---------- */
  job({
    company: 'acme', title: 'Software Engineering Intern', type: 'internship', sector: 'it_software', level: 'junior', years: 0, mode: 'hybrid', city: 'london', salary: pay('london', 2200, 2400, 'month'), hoursAgo: 30,
    brief: 'Spend six months building real features with our product engineering team. You will pair with a senior engineer every day, ship code to customers and learn how a small SaaS team plans, tests and releases.',
    does: ['Build and test small features in our React and Node.js codebase', 'Pair with engineers on code reviews and bug fixes', 'Write clear notes and demo your work at the end of each sprint'],
    skills: ['JavaScript', 'Git', 'HTML', 'CSS'], nice: ['React', 'Node.js'],
  }),
  job({
    company: 'brightwire', title: 'Senior Backend Engineer', sector: 'it_software', level: 'senior', years: 6, mode: 'remote', salary: pay('remote', 105000, 135000), hoursAgo: 8, remote: ['IE', 'GB', 'NL', 'DE', 'PT'],
    brief: 'Design and scale the sync engine and APIs behind a fast issue tracker used by thousands of software teams. You will own services end to end, from data model to production monitoring.',
    does: ['Design and run backend services that keep data in sync in real time', 'Improve performance and reliability of our APIs and database layer', 'Review designs and mentor engineers across the platform team', 'Take part in a calm, well-run on-call rotation'],
    skills: ['Node.js', 'PostgreSQL', 'Distributed Systems', 'API Design'], nice: ['TypeScript', 'Kubernetes'],
  }),
  job({
    company: 'tessel', title: 'Privacy Counsel', sector: 'legal', level: 'senior', years: 6, mode: 'hybrid', city: 'amsterdam', salary: pay('amsterdam', 95000, 120000), hoursAgo: 52, languages: [['en', 'c2']],
    brief: 'Advise product and engineering teams on privacy by design for a workspace that holds millions of people’s notes and documents. You will lead our GDPR programme in Europe and work closely with security.',
    does: ['Advise teams on GDPR and ePrivacy questions as they build new features', 'Run data protection impact assessments and keep records of processing up to date', 'Negotiate data processing terms with customers and vendors', 'Train colleagues on privacy and handle regulator questions'],
    skills: ['GDPR', 'Data Protection', 'Commercial Contracts', 'Legal Advice'], nice: ['CIPP/E'],
  }),
  job({
    company: 'clearwater', title: 'Financial Crime Analyst', sector: 'finance_economics', level: 'mid', years: 2, mode: 'hybrid', city: 'dublin', salary: pay('dublin', 55000, 68000), hoursAgo: 20,
    brief: 'Protect businesses and their customers by finding and stopping fraud and money laundering on our payments network. You will investigate alerts, explain findings clearly and help improve our detection rules.',
    does: ['Investigate transaction monitoring alerts and decide on next steps', 'Write clear case notes and file suspicious activity reports', 'Spot new patterns and suggest improvements to detection rules'],
    skills: ['Anti-Money Laundering', 'Investigations', 'Risk Assessment', 'SQL'], nice: ['ACAMS'],
  }),
  job({
    company: 'northlink', title: 'Senior Product Counsel', sector: 'legal', level: 'senior', years: 7, mode: 'hybrid', city: 'dublin', salary: pay('dublin', 120000, 150000), hoursAgo: 140,
    brief: 'Be the legal partner for teams launching new payment products across Europe. You will turn complex financial regulation into clear, practical advice that helps us ship safely and quickly.',
    does: ['Advise product teams on payments, e-money and consumer protection rules', 'Draft and negotiate partner and bank agreements', 'Work with compliance on licences and regulator relationships', 'Build guidance that lets teams answer common questions themselves'],
    skills: ['Financial Regulation', 'Commercial Contracts', 'Payments', 'Legal Advice'], nice: ['PSD2'],
  }),
  job({
    company: 'sketchbook', title: 'Education Programme Manager', sector: 'education', level: 'mid', years: 4, mode: 'hybrid', city: 'london', salary: pay('london', 58000, 70000), hoursAgo: 74,
    brief: 'Help students and teachers learn design with our tools. You will build our education programme with universities and schools across Europe, from free licences to course material and teacher training.',
    does: ['Partner with universities and schools to bring design into their courses', 'Create lesson plans, guides and workshops with our community', 'Run teacher training sessions online and in person', 'Measure what works and report on the programme’s reach'],
    skills: ['Curriculum Design', 'Programme Management', 'Workshop Facilitation', 'Stakeholder Management'], nice: ['Teaching Experience'],
  }),
  job({
    company: 'stackyard', title: 'Developer Advocate', sector: 'marketing_media', level: 'mid', years: 3, mode: 'remote', salary: pay('remote', 85000, 105000), hoursAgo: 33, remote: ['DE', 'NL', 'FR', 'ES', 'PL', 'GB'],
    brief: 'Help developers succeed with the web platform by writing, speaking and building in public. You will create tutorials, demos and talks, and bring what you hear from the community back to our product teams.',
    does: ['Write tutorials, guides and example projects', 'Speak at meetups and conferences and run live streams', 'Collect developer feedback and share it with product teams'],
    skills: ['JavaScript', 'Technical Writing', 'Public Speaking', 'React'], nice: ['Next.js', 'Video Production'],
  }),
  job({
    company: 'nordsound', title: 'Music Editor, Nordics', sector: 'arts_culture', level: 'mid', years: 3, mode: 'hybrid', city: 'stockholm', salary: pay('stockholm', 480000, 560000), hoursAgo: 46, languages: [['sv', 'c1'], ['en', 'c1']],
    brief: 'Shape what millions of listeners hear by curating playlists for the Nordic market. You will follow local scenes closely, champion new artists and work with labels and data teams to tell their stories.',
    does: ['Curate and refresh editorial playlists for Nordic listeners', 'Spot and champion emerging artists across genres', 'Work with labels, artists and marketing on releases and campaigns', 'Use listening data to learn what resonates'],
    skills: ['Music Curation', 'Nordic Music Scene', 'Editorial Writing', 'Data Analysis'], nice: ['Artist Relations'],
  }),
  job({
    company: 'fjord', title: 'People Partner', sector: 'hr_recruitment', level: 'senior', years: 6, mode: 'hybrid', city: 'stockholm', salary: pay('stockholm', 620000, 720000), hoursAgo: 160,
    brief: 'Partner with leaders in our product organisation on everything people: organisation design, performance, development and change. You will be a trusted adviser who uses data and empathy in equal measure.',
    does: ['Advise leaders on team structure, performance and growth', 'Lead the people side of organisational change', 'Coach managers through difficult conversations', 'Use people data to spot trends and act on them'],
    skills: ['HR Business Partnering', 'Employee Relations', 'Organisational Design', 'Coaching'], nice: ['Swedish Labour Law'],
  }),
  job({
    company: 'lojista', title: 'Merchant Success Manager', sector: 'retail_ecommerce', level: 'mid', years: 3, mode: 'hybrid', city: 'lisbon', salary: pay('lisbon', 38000, 48000), hoursAgo: 26, languages: [['pt', 'c1'], ['en', 'c1']],
    brief: 'Help growing online shops in Portugal and Spain get the most from our platform. You will own a group of merchants, understand their business and guide them through launches, peak season and growth.',
    does: ['Own relationships with a portfolio of growing merchants', 'Run onboarding and quarterly business reviews', 'Spot opportunities and recommend apps, features and partners', 'Share merchant feedback with product teams'],
    skills: ['Account Management', 'E-commerce', 'Customer Success', 'Retail Operations'], nice: ['Spanish'],
  }),
  job({
    company: 'mercado', title: 'Customer Support Specialist', type: 'part_time', sector: 'retail_ecommerce', level: 'junior', years: 1, mode: 'remote', salary: pay('remote', 1500, 1700, 'month'), hoursAgo: 4, remote: ['PT', 'ES', 'IE'],
    brief: 'Answer questions from shop owners by chat and email, 20 hours a week. You will solve problems with orders, payments and store setup, and make sure every merchant leaves the conversation with an answer.',
    does: ['Answer merchant questions by chat and email', 'Troubleshoot store setup, orders and payment issues', 'Write and improve help centre articles'],
    skills: ['Customer Service', 'Written Communication', 'Problem Solving'], nice: ['E-commerce'],
  }),
  job({
    company: 'atelierpixel', title: 'Content Marketing Manager', sector: 'marketing_media', level: 'mid', years: 4, mode: 'hybrid', city: 'paris', salary: pay('paris', 52000, 64000), hoursAgo: 58, languages: [['fr', 'native'], ['en', 'b2']],
    brief: 'Grow our French-speaking community with content people love to share. You will plan the content calendar, write and commission articles, and work with designers on campaigns across social and email.',
    does: ['Own the French content calendar across blog, social and email', 'Write, edit and commission articles and guides', 'Work with designers and local creators on campaigns', 'Track results and improve what we publish'],
    skills: ['Content Marketing', 'Copywriting', 'SEO', 'Social Media'], nice: ['Email Marketing'],
  }),
  job({
    company: 'maisonverte', title: 'Marketing Intern', type: 'internship', sector: 'marketing_media', level: 'junior', years: 0, mode: 'on_site', city: 'paris', salary: pay('paris', 1300, 1400, 'month'), hoursAgo: 96, languages: [['fr', 'c1']],
    brief: 'Join our Paris marketing team for six months and learn how campaigns are planned, made and measured. You will help with social posts, events and creator partnerships from day one.',
    does: ['Help plan and post social media content', 'Support events and creator partnerships', 'Prepare weekly campaign reports'],
    skills: ['Social Media', 'Copywriting', 'Canva'], nice: ['Photography'],
  }),
  job({
    company: 'thameside', title: 'Credit Risk Analyst', sector: 'finance_economics', level: 'mid', years: 2, mode: 'on_site', city: 'london', salary: pay('london', 52000, 62000), hoursAgo: 110,
    brief: 'Help us lend responsibly by building the models and policies behind our loans and overdrafts. You will analyse customer data, test new rules and explain your findings to people outside risk.',
    does: ['Analyse lending performance and spot early warning signs', 'Build and test credit decision rules', 'Present findings and recommendations to product and risk committees'],
    skills: ['Credit Risk', 'SQL', 'Python', 'Statistics'], nice: ['Affordability Modelling'],
  }),
  job({
    company: 'ferro', title: 'Talent Acquisition Partner', sector: 'hr_recruitment', level: 'mid', years: 3, mode: 'hybrid', city: 'london', salary: pay('london', 48000, 58000), hoursAgo: 12,
    brief: 'Hire the engineers and designers who build our bank. You will run hiring end to end with fair, structured interviews, and make every candidate’s experience clear and kind, whatever the outcome.',
    does: ['Run hiring processes end to end with hiring managers', 'Source and engage candidates for hard-to-fill roles', 'Keep interviews structured and fair', 'Report on pipeline health and hiring outcomes'],
    skills: ['Technical Recruiting', 'Sourcing', 'Stakeholder Management', 'Interviewing'], nice: ['Employer Branding'],
  }),

  /* ---------- the sector employers ---------- */
  job({
    company: 'harbourview', title: 'Staff Nurse, Acute Medicine', sector: 'healthcare', level: 'mid', years: 1, mode: 'on_site', city: 'manchester', salary: pay('manchester', 31000, 38000), hoursAgo: 6, visa: true,
    brief: 'Care for adults admitted with acute medical conditions on a busy 28-bed ward. You will work in a supportive team with protected study time, preceptorship for newly qualified nurses and clear routes to progress.',
    does: ['Assess, plan and deliver care for a group of patients each shift', 'Give medicines safely and keep accurate records', 'Work with doctors, therapists and families on discharge plans', 'Support students and healthcare assistants on the ward'],
    skills: ['Registered Nurse', 'Patient Assessment', 'Medication Administration', 'Clinical Documentation'], nice: ['IV Therapy'],
  }),
  job({
    company: 'oakwood', title: 'Healthcare Assistant', type: 'part_time', sector: 'healthcare', level: 'junior', years: 0, mode: 'on_site', city: 'manchester', salary: pay('manchester', 1100, 1250, 'month'), hoursAgo: 70,
    brief: 'Help residents with everyday care in our care home for older people, 22.5 hours a week. No experience needed: full training and a care certificate are provided, with shifts that fit around family or study.',
    does: ['Help patients with washing, dressing, eating and moving', 'Take and record observations such as temperature and blood pressure', 'Keep the ward safe, clean and welcoming'],
    skills: ['Patient Care', 'Communication', 'Teamwork'], nice: ['Care Certificate'],
  }),
  job({
    company: 'nwtrials', title: 'Clinical Research Coordinator', sector: 'science_research', level: 'mid', years: 2, mode: 'hybrid', city: 'manchester', salary: pay('manchester', 34000, 41000), hoursAgo: 120,
    brief: 'Run clinical trials in our research unit, from patient recruitment to data entry. You will make sure studies follow the protocol and good clinical practice, and be the friendly first contact for participants.',
    does: ['Screen, consent and follow up trial participants', 'Collect and enter study data accurately', 'Prepare for monitoring visits and audits'],
    skills: ['Clinical Trials', 'Good Clinical Practice', 'Data Management', 'Patient Communication'], nice: ['Phlebotomy'],
  }),
  job({
    company: 'brandt', title: 'Site Manager', sector: 'construction_trades', level: 'senior', years: 8, mode: 'on_site', city: 'berlin', salary: pay('berlin', 68000, 82000), hoursAgo: 36, languages: [['de', 'c1']],
    brief: 'Lead the construction of a 64-apartment housing project in Berlin-Pankow from groundworks to handover. You will run the site day to day, keep it safe and keep trades, budget and programme on track.',
    does: ['Run the site day to day and coordinate subcontractors', 'Keep health and safety standards high and documented', 'Track programme, quality and costs and report to the project manager', 'Lead handover to the client and residents'],
    skills: ['Site Management', 'Health and Safety', 'Construction Planning', 'Subcontractor Management'], nice: ['SCC Certificate'],
  }),
  job({
    company: 'spreeelektro', title: 'Electrician', sector: 'construction_trades', level: 'mid', years: 3, mode: 'on_site', city: 'berlin', salary: pay('berlin', 42000, 50000), hoursAgo: 90, languages: [['de', 'b2']],
    brief: 'Install and test electrical systems in new homes and school refurbishments across Berlin. You will work in a small team with a company van, good tools and regular, local working hours.',
    does: ['Install wiring, distribution boards and lighting to plan', 'Test and certify installations', 'Find and fix faults safely'],
    skills: ['Electrical Installation', 'Testing and Inspection', 'Wiring Regulations'], nice: ['Smart Home Systems'],
  }),
  job({
    company: 'northfield', title: 'Secondary Maths Teacher', sector: 'education', level: 'mid', years: 2, mode: 'on_site', city: 'barcelona', salary: pay('barcelona', 32000, 40000), hoursAgo: 44, languages: [['en', 'c2'], ['es', 'b1']],
    brief: 'Teach maths to pupils aged 11 to 18 following the British curriculum and the IB Diploma. You will join a friendly department with small classes, shared resources and funded professional development.',
    does: ['Plan and teach engaging maths lessons across KS3, IGCSE and IB', 'Assess progress and give clear feedback to pupils and parents', 'Run a club or support a school trip each year'],
    skills: ['Mathematics Teaching', 'Lesson Planning', 'Classroom Management', 'Assessment'], nice: ['IB Diploma'],
  }),
  job({
    company: 'llegimjunts', title: 'Reading Volunteer', type: 'volunteer', sector: 'education', level: 'junior', years: 0, mode: 'on_site', city: 'barcelona', hoursAgo: 200,
    brief: 'Read with younger pupils for an hour or two a week and help them grow in confidence. No teaching experience needed, just patience and a love of books; we provide training and a friendly volunteer team.',
    does: ['Read one to one with pupils aged 6 to 9', 'Note progress in a simple reading log', 'Join a short training session each term'],
    skills: ['Patience', 'Reading', 'Communication'],
  }),
  job({
    company: 'commonground', title: 'Fundraising Manager', sector: 'charity_nonprofit', level: 'mid', years: 4, mode: 'hybrid', city: 'lyon', salary: pay('lyon', 38000, 44000), hoursAgo: 16, languages: [['fr', 'c1']],
    brief: 'Grow the income that keeps our food banks and job clubs open. You will build relationships with foundations, companies and local donors, and turn our impact into proposals people want to support.',
    does: ['Write grant applications and reports for foundations', 'Build partnerships with local companies', 'Plan and run community fundraising events', 'Keep our donor records tidy and up to date'],
    skills: ['Fundraising', 'Grant Writing', 'Partnership Development', 'Budgeting'], nice: ['CRM Systems'],
  }),
  job({
    company: 'rhonewelcome', title: 'Volunteer Coordinator', type: 'part_time', sector: 'charity_nonprofit', level: 'junior', years: 1, mode: 'on_site', city: 'lyon', salary: pay('lyon', 1200, 1350, 'month'), hoursAgo: 64, languages: [['fr', 'c1']],
    brief: 'Recruit, welcome and support the 150 volunteers who run our language cafés and welcome desks, three days a week. You will make sure every volunteer feels trained, valued and part of the team.',
    does: ['Recruit and onboard new volunteers', 'Plan weekly volunteer rotas', 'Organise thank-you events and gather feedback'],
    skills: ['Volunteer Management', 'Scheduling', 'Communication'], nice: ['Arabic'],
  }),
  job({
    company: 'paniersolidaire', title: 'Food Bank Volunteer', type: 'volunteer', sector: 'charity_nonprofit', level: 'junior', years: 0, mode: 'on_site', city: 'lyon', hoursAgo: 230,
    brief: 'Give a few hours a week to sort donations and welcome families at our food bank in the 8th arrondissement. Morning and evening shifts are available, and you can bring a friend.',
    does: ['Sort and stack food donations', 'Welcome families and help them choose their parcel', 'Keep the storeroom clean and organised'],
    skills: ['Teamwork', 'Reliability', 'Friendliness'],
  }),
  job({
    company: 'casabrava', title: 'Exhibitions Curator', sector: 'arts_culture', level: 'senior', years: 6, mode: 'on_site', city: 'madrid', salary: pay('madrid', 40000, 48000), hoursAgo: 80, languages: [['es', 'c1'], ['en', 'b2']],
    brief: 'Shape our exhibition programme for the next three years, with a focus on emerging Spanish and Latin American artists. You will develop shows from first idea to opening night and the public programme around them.',
    does: ['Research and propose exhibitions and commissions', 'Work with artists, lenders and designers to deliver shows', 'Write exhibition texts and catalogue essays', 'Manage exhibition budgets and timelines'],
    skills: ['Curating', 'Contemporary Art', 'Exhibition Management', 'Art Writing'], nice: ['Collection Management'],
  }),
  job({
    company: 'veranosonoro', title: 'Festival Volunteer', type: 'volunteer', sector: 'arts_culture', level: 'junior', years: 0, mode: 'on_site', city: 'madrid', hoursAgo: 260, languages: [['es', 'b1']],
    brief: 'Be part of our ten-day summer festival: welcome audiences, help artists backstage and keep events running smoothly. Volunteers get festival passes, meals on shift and a certificate.',
    does: ['Welcome audiences and check tickets', 'Help artists and crew backstage', 'Give directions and information to visitors'],
    skills: ['Customer Service', 'Teamwork', 'Flexibility'],
  }),
  job({
    company: 'valemont', title: 'Housing Policy Officer', sector: 'public_sector', level: 'mid', years: 3, mode: 'hybrid', city: 'manchester', salary: pay('manchester', 37000, 42000), hoursAgo: 18,
    brief: 'Help shape how the district tackles its housing shortage. You will research options, write clear reports for councillors and work with residents, housing associations and developers on new policies.',
    does: ['Research housing need and policy options', 'Write reports and briefings for councillors', 'Consult residents and partners on new policies', 'Monitor how policies work in practice'],
    skills: ['Policy Analysis', 'Report Writing', 'Stakeholder Engagement', 'Research'], nice: ['Housing Law'],
  }),
  job({
    company: 'ashbyvale', title: 'Planning Officer', sector: 'public_sector', level: 'mid', years: 2, mode: 'hybrid', city: 'manchester', salary: pay('manchester', 34000, 40000), hoursAgo: 100,
    brief: 'Assess planning applications for homes, shops and community buildings across the district. You will visit sites, weigh up the evidence and write clear recommendations that stand up to scrutiny.',
    does: ['Assess householder and minor planning applications', 'Visit sites and talk with applicants and neighbours', 'Write reports and recommendations'],
    skills: ['Town Planning', 'Planning Law', 'Report Writing', 'Site Assessment'], nice: ['RTPI Membership'],
  }),
  job({
    company: 'marrowdale', title: 'Graduate Policy Intern', type: 'internship', sector: 'public_sector', level: 'junior', years: 0, mode: 'hybrid', city: 'manchester', salary: pay('manchester', 1900, 2000, 'month'), hoursAgo: 150,
    brief: 'A twelve-week paid internship for recent graduates who want to see how local government works. You will rotate through housing, climate and communities teams and finish with your own project.',
    does: ['Support research and data analysis for policy teams', 'Take notes at meetings and draft briefings', 'Deliver a short project and present it to directors'],
    skills: ['Research', 'Writing', 'Data Analysis'], nice: ['Excel'],
  }),
  job({
    company: 'marisol', title: 'Front Office Manager', sector: 'hospitality_tourism', level: 'mid', years: 4, mode: 'on_site', city: 'lisbon', salary: pay('lisbon', 28000, 34000), hoursAgo: 28, languages: [['pt', 'b2'], ['en', 'c1']],
    brief: 'Lead the reception team at our 80-room boutique hotel in Cascais. You will make every arrival feel personal, run a smooth front desk around the clock and coach a young, multilingual team.',
    does: ['Lead and schedule the reception and concierge team', 'Handle guest requests, feedback and special occasions', 'Manage room allocation and the booking system', 'Train new team members'],
    skills: ['Front Office Operations', 'Guest Relations', 'Team Leadership', 'Hotel Booking Systems'], nice: ['French'],
  }),
  job({
    company: 'tabernadocais', title: 'Sous Chef', sector: 'hospitality_tourism', level: 'senior', years: 5, mode: 'on_site', city: 'lisbon', salary: pay('lisbon', 26000, 31000), hoursAgo: 130,
    brief: 'Run the kitchen alongside our head chef in a 60-cover seafood restaurant. You will cook with local produce, keep standards high on every service and help develop our seasonal menus.',
    does: ['Run services and lead the kitchen team when the head chef is off', 'Develop seasonal dishes with local suppliers', 'Keep food safety, stock and costs under control'],
    skills: ['Cooking', 'Kitchen Management', 'Food Safety', 'Menu Development'], nice: ['Portuguese Cuisine'],
  }),
  job({
    company: 'vistula', title: 'Transport Planner', sector: 'logistics_transport', level: 'mid', years: 2, mode: 'on_site', city: 'warsaw', salary: pay('warsaw', 96000, 120000), hoursAgo: 22, languages: [['pl', 'native'], ['en', 'b2']],
    brief: 'Plan routes and loads for 120 trucks moving goods across Poland, Germany and the Czech Republic. You will balance cost, time and drivers’ rest rules, and solve problems as they happen on the road.',
    does: ['Plan daily routes and load assignments', 'Keep drivers, customers and warehouses informed', 'Solve delays and breakdowns as they happen', 'Track costs and on-time delivery'],
    skills: ['Route Planning', 'Transport Management Systems', 'Problem Solving', 'Excel'], nice: ['German'],
  }),
  job({
    company: 'mazovia', title: 'Supply Chain Analyst', sector: 'logistics_transport', level: 'mid', years: 3, mode: 'hybrid', city: 'warsaw', salary: pay('warsaw', 130000, 160000), hoursAgo: 175, languages: [['en', 'c1']],
    brief: 'Turn data from our fleet and warehouses into better decisions. You will build dashboards, model network changes and work with operations to cut empty miles and delivery times.',
    does: ['Build and maintain operational dashboards', 'Model changes to routes and warehouse capacity', 'Present findings and recommendations to managers'],
    skills: ['Supply Chain Analysis', 'SQL', 'Power BI', 'Forecasting'], nice: ['Python'],
  }),
  job({
    company: 'harcourt', title: 'Commercial Solicitor', sector: 'legal', level: 'mid', years: 4, mode: 'hybrid', city: 'london', salary: pay('london', 85000, 105000), hoursAgo: 40,
    brief: 'Advise technology and media clients on their commercial contracts, from SaaS terms to licensing and outsourcing deals. You will run your own matters with partner support and real client contact.',
    does: ['Draft and negotiate commercial agreements', 'Advise clients on contract risk and disputes', 'Supervise trainees and paralegals', 'Help develop client relationships'],
    skills: ['Commercial Contracts', 'Contract Negotiation', 'Technology Law', 'Legal Drafting'], nice: ['Data Protection'],
  }),
  job({
    company: 'bramwell', title: 'Vacation Scheme Trainee', type: 'internship', sector: 'legal', level: 'junior', years: 0, mode: 'on_site', city: 'london', salary: pay('london', 2300, 2300, 'month'), hoursAgo: 210,
    brief: 'A paid three-week summer scheme for law and non-law students thinking about a training contract. You will sit with two practice groups, work on real matters and get feedback from a supervising associate.',
    does: ['Research legal questions and summarise findings', 'Help draft documents and meeting notes', 'Take part in a team negotiation exercise'],
    skills: ['Legal Research', 'Writing', 'Attention to Detail'], nice: ['Mooting'],
  }),
  job({
    company: 'keystone', title: 'Property Manager', sector: 'real_estate', level: 'mid', years: 3, mode: 'on_site', city: 'dublin', salary: pay('dublin', 42000, 50000), hoursAgo: 14,
    brief: 'Look after a portfolio of around 150 rented homes across south Dublin. You will be the main contact for landlords and tenants, from inspections and repairs to renewals and deposits.',
    does: ['Manage a portfolio of residential properties', 'Arrange inspections, repairs and contractors', 'Handle tenancy renewals, rent reviews and deposits', 'Keep landlords informed with clear monthly reports'],
    skills: ['Property Management', 'Tenancy Law', 'Customer Service', 'Contractor Management'], nice: ['PSRA Licence'],
  }),
  job({
    company: 'liffey', title: 'Lettings Negotiator', sector: 'real_estate', level: 'junior', years: 1, mode: 'on_site', city: 'dublin', salary: pay('dublin', 32000, 38000), hoursAgo: 86,
    brief: 'Match tenants with the right homes and help landlords let quickly and fairly. You will run viewings, check references and guide people through their new tenancy step by step.',
    does: ['Run property viewings and follow up with applicants', 'Check references and prepare tenancy agreements', 'Keep listings accurate and up to date'],
    skills: ['Sales', 'Customer Service', 'Negotiation'], nice: ['Driving Licence'],
  }),
  job({
    company: 'grafton', title: 'Real Estate Analyst', type: 'contract', sector: 'real_estate', level: 'mid', years: 2, mode: 'hybrid', city: 'dublin', salary: pay('dublin', 45000, 52000), hoursAgo: 190,
    brief: 'A twelve-month contract to analyse rents, yields and market trends for our landlords. You will build the valuation models and market reports that guide where clients buy and how they price.',
    does: ['Build rent and yield models for residential portfolios', 'Write monthly market reports', 'Support valuations and acquisition reviews'],
    skills: ['Financial Modelling', 'Market Research', 'Excel', 'Property Valuation'], nice: ['Power BI'],
  }),
  job({
    company: 'lindqvist', title: 'Postdoctoral Researcher, Climate Modelling', type: 'contract', sector: 'science_research', level: 'mid', years: 2, mode: 'hybrid', city: 'stockholm', salary: pay('stockholm', 460000, 520000), hoursAgo: 60, visa: true, languages: [['en', 'c1']],
    brief: 'A two-year position modelling how the Baltic Sea responds to warming and changes in river run-off. You will run regional climate and ocean models, publish your results and help supervise PhD students.',
    does: ['Set up and run regional ocean and climate simulations', 'Analyse model output and compare it with observations', 'Publish results and present at conferences', 'Co-supervise PhD students'],
    skills: ['Climate Modelling', 'Python', 'Scientific Computing', 'Data Analysis'], nice: ['Fortran', 'Oceanography'],
  }),
  job({
    company: 'balticlab', title: 'Summer Research Intern', type: 'internship', sector: 'science_research', level: 'junior', years: 0, mode: 'on_site', city: 'stockholm', salary: pay('stockholm', 22000, 24000, 'month'), hoursAgo: 220,
    brief: 'Spend ten weeks in our environmental chemistry lab working on a real research question. You will collect and analyse samples, learn lab methods and present a poster at our summer symposium.',
    does: ['Prepare and analyse water and sediment samples', 'Record results carefully in the lab notebook', 'Present a research poster at the end of the summer'],
    skills: ['Laboratory Techniques', 'Chemistry', 'Data Recording'], nice: ['R'],
  }),
  job({
    company: 'arcwell', title: 'Mechanical Design Engineer', sector: 'engineering', level: 'mid', years: 3, mode: 'hybrid', city: 'munich', salary: pay('munich', 62000, 74000), hoursAgo: 10, visa: true, languages: [['de', 'b2'], ['en', 'b2']],
    brief: 'Design test rigs for electric drivetrains and batteries, from first sketch to commissioning at the customer. You will work in small project teams and see your designs built in our own workshop.',
    does: ['Design mechanical assemblies and produce drawings in CAD', 'Calculate loads and select components', 'Work with the workshop during build and testing', 'Support commissioning at customer sites'],
    skills: ['Mechanical Design', 'CAD', 'Engineering Calculations', 'Technical Drawings'], nice: ['SolidWorks', 'FEA'],
  }),
  job({
    company: 'isar', title: 'Controls Engineer', type: 'contract', sector: 'engineering', level: 'senior', years: 6, mode: 'on_site', city: 'munich', salary: pay('munich', 78000, 90000), hoursAgo: 115, languages: [['de', 'c1']],
    brief: 'A nine-month contract to program and commission the controls for a new battery test line. You will write PLC code, set up safety systems and work with the customer’s team on site.',
    does: ['Program PLCs and operator screens', 'Design and test safety functions', 'Commission the line on site with the customer'],
    skills: ['PLC Programming', 'Siemens TIA Portal', 'Functional Safety', 'Commissioning'], nice: ['Python'],
  }),
  job({
    company: 'terraverde', title: 'Farm Operations Manager', sector: 'agriculture_food', level: 'senior', years: 6, mode: 'on_site', city: 'madrid', salary: pay('madrid', 42000, 50000), hoursAgo: 15, languages: [['es', 'c1']],
    brief: 'Run day-to-day operations across our olive groves and vegetable farms south of Madrid. You will plan planting and harvest with the agronomy team, lead 40 field staff and keep machinery, water and safety in good order.',
    does: ['Plan planting, irrigation and harvest schedules', 'Lead and schedule field teams through the seasons', 'Manage machinery, maintenance and farm budgets', 'Keep food safety and organic certification records'],
    skills: ['Farm Management', 'Crop Planning', 'Team Leadership', 'Irrigation'], nice: ['Organic Certification'],
  }),
  job({
    company: 'polderfresh', title: 'Food Technologist', sector: 'agriculture_food', level: 'mid', years: 3, mode: 'on_site', city: 'amsterdam', salary: pay('amsterdam', 46000, 56000), hoursAgo: 42, languages: [['en', 'c1']],
    brief: 'Develop new salads, soups and ready meals and take them from kitchen trial to the production line. You will work with growers, the factory and retail customers on recipes, shelf life and labelling.',
    does: ['Develop and trial new recipes with the product team', 'Run shelf-life and taste tests', 'Write product specifications and labels', 'Support the first production runs on the factory floor'],
    skills: ['Food Science', 'Product Development', 'HACCP', 'Food Labelling'], nice: ['Dutch'],
  }),
  job({
    company: 'zlotyklos', title: 'Seasonal Harvest Operator', type: 'contract', sector: 'agriculture_food', level: 'junior', years: 1, mode: 'on_site', city: 'warsaw', salary: pay('warsaw', 6500, 7500, 'month'), hoursAgo: 75, languages: [['pl', 'b1']],
    brief: 'A four-month contract driving combines and grain trailers through the summer harvest. Training on our machines is provided, accommodation is available on the farm, and harvest bonuses are paid on top.',
    does: ['Drive combines and grain trailers safely', 'Carry out daily machine checks and cleaning', 'Deliver grain to our store and record the loads'],
    skills: ['Agricultural Machinery', 'Driving Licence', 'Reliability'], nice: ['Tractor Licence'],
  }),
]
