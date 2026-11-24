import { ENUMS } from '../../config/enums.js'
import { LIMITS } from '../../config/limits.js'

/*
 * Instructions and JSON schemas of every AI text (U4, M-057 … M-062, M-144). OpenAI only writes words around facts the
 * code supplies; the instructions forbid inventing facts and using protected characteristics (M-021, M-187).
 */
const RULES = [
  'You write for a European job platform. Use only the facts in the input; never invent employers, skills, numbers, dates or qualifications.',
  'Never mention or infer protected characteristics (age, gender, ethnicity, nationality, religion, disability, health or family status).',
  'Write plainly and briefly. Evidence is not a hiring decision, and a missing field is missing evidence, not a missing ability.',
].join('\n')

// 2026-11-16 (worldwide): where the candidate may work and whether the company sponsors a work visa.
const VISA =
  `Right to work: the candidate's rightToWork lists where they may already work ("EU" means all 27 EU countries) and the evidence says whether that covers the job's country. visaSponsorship true means the company sponsors a work visa, so a candidate without that right can still take the job: say so plainly. When it is false and the candidate cannot already work there, name it as a point to check. Never infer a nationality from where someone may work.`

// 2026-11-17 (phase 2): drafts a recruiter reviews and edits before using them.
const DRAFT_RULES = [
  'You draft text for a recruiter on a European job platform; the recruiter reviews and edits it before it is used.',
  'Never invent facts about the company, salary, benefits, location, dates, contact details or people: leave out what the input does not give.',
  'Never mention or infer protected characteristics (age, gender, ethnicity, nationality, religion, disability, health or family status), and never write requirements that would exclude people on those grounds.',
  'Write plainly and warmly, without buzzwords, exclamation marks or placeholders such as [name] or [date].',
].join('\n')

// 2026-11-17 (phase 3): drafts a candidate reviews and edits before using them.
const CANDIDATE_RULES = [
  'You draft text for a candidate on a European job platform; the candidate reviews and edits it before it is used.',
  'Use only the candidate facts in the input: never invent experience, employers, job titles, dates, numbers, skills, qualifications or achievements.',
  'Never mention or infer protected characteristics (age, gender, ethnicity, nationality, religion, disability, health or family status).',
  'Write plainly and confidently in the first person, without buzzwords, exclamation marks or placeholders such as [company].',
].join('\n')

const J = LIMITS.job
const P = LIMITS.profile
const LANGUAGE_LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'native']
const JOB_LEVELS = ['junior', 'mid', 'senior', 'lead']

const text = { type: 'string' }
const texts = { type: 'array', items: text }
const object = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false })
const snapshot = object({ role: text, years: { type: 'integer' }, skills: texts })

export const PROMPTS = {
  // 2026-11-17 (phase 3): the cover note writer in the apply dialog.
  coverNote: {
    kind: 'cover_note',
    schema: object({ coverNote: text }),
    instructions: `${CANDIDATE_RULES}
Write a short cover note for this job application from the candidate's profile and the job: why this role, the two or three most relevant things from their experience and skills (only what the profile says), and one closing line. 80 to 160 words, two or three short paragraphs, no greeting line and no signature. Use the candidate's notes when given.`,
  },
  // 2026-11-17: a job alert from one sentence; the server looks the city up in Places.
  jobAlertDraft: {
    kind: 'job_alert_draft',
    schema: object({ name: text, keywords: text, city: text, countryCode: text, frequency: { type: 'string', enum: ['instant', 'daily', 'weekly'] } }),
    instructions: `Turn the candidate's sentence into a job alert.
name: a short label of at most ${LIMITS.jobAlert.name.max} characters (for example "Remote React roles").
keywords: the role, skills or terms to search for, at most ${LIMITS.jobAlert.keywords.max} characters, without the place or the frequency.
city and countryCode: the city they name and its ISO 3166-1 alpha-2 country code (GB for the United Kingdom); both empty strings when they name no city (remote, a country only, or nothing).
frequency: instant, daily or weekly as they say; daily when they do not say.`,
  },
  // 2026-11-17: the headline and About writer on the profile.
  profileText: {
    kind: 'profile_text',
    schema: object({ headline: text, about: text }),
    instructions: `${CANDIDATE_RULES}
From the candidate's work history, skills, education, years of experience and preferences, write:
headline: their current or target role in at most ${P.headline.max} characters (for example "Senior Product Designer · Design Systems").
about: what they do, their strongest skills and experience, and what they are looking for, in ${P.about.min * 3} to ${P.about.max} characters, first person, one or two short paragraphs.`,
  },
  // 2026-11-17: interview prep for a confirmed interview.
  interviewPrep: {
    kind: 'interview_prep',
    schema: object({ questions: { type: 'array', items: object({ question: text, talkingPoint: text }) }, askThem: texts }),
    instructions: `${CANDIDATE_RULES}
Help the candidate prepare for their interview for this job. Give 6 to 8 questions the interviewer is likely to ask about this role (its responsibilities and required skills, and one or two about motivation), each with a talking point of one or two sentences that tells the candidate which part of their own profile to use; when the profile has nothing for a question, say so honestly and suggest how to answer it. Then give 3 good questions the candidate could ask the company about this role. Address the candidate as "you".`,
  },
  // 2026-11-17: the voice profile builder, from the transcript of up to 3 minutes of the candidate talking.
  voiceProfile: {
    kind: 'voice_profile',
    schema: object({
      headline: text,
      about: text,
      yearsExperience: { type: 'integer' },
      skills: texts,
      workHistory: { type: 'array', items: object({ title: text, employer: text, start: text, end: text, current: { type: 'boolean' } }) },
      education: { type: 'array', items: object({ degree: text, institution: text }) },
      languages: { type: 'array', items: object({ code: text, level: { type: 'string', enum: LANGUAGE_LEVELS } }) },
    }),
    instructions: `${CANDIDATE_RULES}
The input is the transcript of a candidate talking about themselves (it may ramble, repeat or correct itself; later corrections win). Fill their profile from it:
headline: current or target role, at most ${P.headline.max} characters.
about: first person, ${P.about.min * 3} to ${P.about.max} characters, from what they said.
yearsExperience: total years of professional experience as a whole number (0 when they do not say).
skills: up to ${P.skills.max} professional skills they mention, each at most ${P.skills.itemMax} characters.
workHistory: jobs they name, newest first: title, employer, start and end as YYYY-MM (empty string when they do not say; for a year only use YYYY-01), current true for the job they still do (end empty).
education: degrees or courses and institutions they name.
languages: languages they speak, ISO 639-1 code and CEFR level (native for a mother tongue; b2 when they only say they speak it well).
Leave a list empty when they say nothing about it.`,
  },
  // 2026-11-17: the job post writer; the client fills only the fields the recruiter left empty.
  jobDraft: {
    kind: 'job_draft',
    schema: object({
      sector: text,
      brief: text,
      responsibilities: texts,
      requiredSkills: texts,
      preferredSkills: texts,
      level: { type: 'string', enum: JOB_LEVELS },
      experienceYears: { type: 'integer' },
      languages: { type: 'array', items: object({ code: text, minLevel: { type: 'string', enum: LANGUAGE_LEVELS } }) },
    }),
    instructions: `${DRAFT_RULES}
Draft a job posting from the job title, the employment type, the company facts and the recruiter's notes (the notes come first when they say something). Typical duties and skills for this kind of role are fine; facts about this company are only those given.
brief: what the role is and why it matters, 60 to 160 words, in the second person ("you will…"), no salary or benefits unless the notes give them.
responsibilities: 4 to 7 duties, each one sentence of at most ${J.responsibilities.itemMax} characters, without bullets or numbering.
requiredSkills: 4 to 8 skills essential for the role, each a short standard name of at most ${J.requiredSkills.itemMax} characters (a skill, tool or qualification, not a sentence).
preferredSkills: 2 to 5 nice-to-have skills in the same form, none repeating a required one.
level and experienceYears (a whole number from ${J.experienceYears.min} to ${J.experienceYears.max}): what the title and notes suggest; mid and 3 when nothing does.
languages: only languages the notes ask for or the role plainly needs, as ISO 639-1 codes with a minimum CEFR level (or native); usually none.
sector: the key of the entry in sectors that best describes the kind of work in this role (not the employer's industry: a developer at a bank is IT & Software), copied exactly; an empty string when none fits.`,
  },
  // 2026-11-23 (phase 6): the agency's job post writer: the same draft plus the client, dates, pay rate and hours.
  get agencyJobDraft() {
    const base = PROMPTS.jobDraft
    return {
      kind: base.kind,
      schema: object({
        ...base.schema.properties,
        clientRef: text,
        clientName: text,
        startDate: text,
        endDate: text,
        rate: { type: 'number' },
        ratePeriod: { type: 'string', enum: [...ENUMS.ratePeriod, 'none'] },
        hoursPerWeek: { type: 'integer' },
      }),
      instructions: `${base.instructions}
This is a short-term job an agency fills for one of its clients. Also read the notes for these terms, and only from the notes (never guess them):
clientRef and clientName: the client the notes name. clientRef is the ref of the matching entry in clients (same company, even when written shorter or with a different legal suffix), else an empty string; clientName is the client as the notes write it, else an empty string. Never name the client in brief or responsibilities: write "the client" or describe the kind of business instead.
startDate and endDate: as YYYY-MM-DD, using today (given) for dates such as "next Monday" or "for 3 weeks"; empty strings when the notes give no dates.
rate and ratePeriod: the pay rate as a plain number in the job's currency and whether it is per hour or per day; 0 and none when the notes give no rate.
hoursPerWeek: the weekly hours the notes give, else 0.`,
    }
  },
  // 2026-11-17: the company description writer, from the company's own details only (no website fetching).
  companyDescription: {
    kind: 'company_description',
    schema: object({ description: text }),
    instructions: `${DRAFT_RULES}
Write the "About the company" text candidates read on job postings, from the company facts and the recruiter's notes only: what the company does, for whom, and what working there is like when the notes say so. 60 to 150 words, in the first person plural ("we…"), two short paragraphs at most. Never claim awards, numbers, customers, history or values the input does not give.`,
  },
  // 2026-11-17: the "AI shortlist" of a job's new applicants; the code supplies each applicant's evidence and score.
  applicantShortlist: {
    kind: 'applicant_shortlist',
    schema: object({ items: { type: 'array', items: object({ applicationId: text, reason: text }) } }),
    instructions: `${DRAFT_RULES}
Rank the job's new applicants for a first review, strongest fit first, using only the evidence given per applicant (matching and missing required skills, years of experience, headline, location, the match score and the cover note). Return at most ${LIMITS.ai.shortlist.size} applicants, each with its applicationId copied exactly and one sentence of at most 25 words naming the main reason (or the main gap) from that evidence. This helps the recruiter decide whom to read first; it is not a hiring decision.`,
  },
  // 2026-11-23 (phase 6): one line beside each person of an agency's on-books talent ranked for a job (the code orders them).
  talentRanking: {
    kind: 'talent_ranking',
    schema: object({ items: { type: 'array', items: object({ membershipId: text, reason: text }) } }),
    instructions: `${DRAFT_RULES}
The people are on the agency's books and are listed best match first for one of its short-term jobs; keep that order. For each person write one sentence of at most 20 words naming the main reason they fit (or the main gap), using only their evidence (matching and missing required skills, years of experience, headline, location, work preference and the match score). Copy each membershipId exactly and return every person once. This helps the agency decide whom to offer the job first; it is not a hiring decision.`,
  },
  // 2026-11-17: "Draft with AI" for a recruiter's message: a first message, a status update or a reply.
  messageDraft: {
    kind: 'message_draft',
    schema: object({ body: text }),
    instructions: `${DRAFT_RULES}
Write one message from a recruiter at the company to the candidate, in the recruiter's voice, ready to send after a quick review. purpose says which:
- first_message: a short, personal first message about the job (or the company's open roles when no job is given), naming one or two things from the candidate's profile that fit and ending with one clear next step such as a short call.
- status_update: tell the candidate where their application now stands (status gives the new stage, or not_selected). For not_selected: thank them, say kindly that the company will not move forward, without giving reasons. For a next stage: say what happens next only as far as the input says.
- reply: answer the latest message of the conversation, using the job and candidate facts.
Use the recruiter's notes when given. 40 to 120 words, plain text with short paragraphs, no subject line, no signature block beyond the recruiter's first name when given.`,
  },
  // M-058: a summary of one job for any reader (candidate, recruiter or admin).
  jobSummary: {
    kind: 'job_summary',
    schema: object({ overview: text, highlights: texts, considerations: texts }),
    instructions: `${RULES}\nSummarise the job posting: an overview of two or three sentences, up to four highlights and up to three points a reader should check (missing salary, unclear requirements, location limits). A job that sponsors a work visa (visaSponsorship) is a highlight.`,
  },
  // M-057: the narrative around the code evidence, for the candidate.
  candidateMatch: {
    kind: 'match_explanation',
    schema: object({ summary: text, strengths: texts, gaps: texts }),
    instructions: `${RULES}\nExplain to the candidate, addressed as "you", how their profile relates to this job, using the evidence block: a two-sentence summary, up to three strengths and up to three gaps or open questions. Do not mention any score or percentage.
${VISA}`,
  },
  // M-057, C6: the same for a recruiter, never with a score or a ranking.
  recruiterMatch: {
    kind: 'match_explanation',
    schema: object({ summary: text, strengths: texts, openQuestions: texts }),
    instructions: `${RULES}\nExplain to a recruiter how this candidate's profile relates to the job, using the evidence block: a two-sentence summary, up to three strengths and up to three open questions to ask in an interview. Never mention a score, a percentage or a ranking.
${VISA}`,
  },
  // M-057, M-066: the "Make the evidence visible" card of AI insights.
  insightsOverview: {
    kind: 'insights',
    schema: object({ text }),
    instructions: `${RULES}\nIn two or three sentences addressed to the candidate as "you", suggest how to show concrete evidence (outcomes, projects, own contribution) for the strength named in the input.`,
  },
  // M-064: one practical way to build evidence for each required skill the profile does not list.
  skillGap: {
    kind: 'insights',
    schema: object({ guidance: { type: 'array', items: object({ skill: text, text }) } }),
    instructions: `${RULES}\nFor each skill in missingSkills, in the same order and with the skill name exactly as given, write one or two sentences addressed to the candidate as "you" on a practical way to build or show evidence of it.`,
  },
  // §3.2: an improvement hint for each checklist area of the profile.
  improveProfile: {
    kind: 'insights',
    schema: object({ suggestions: { type: 'array', items: object({ area: text, text }) } }),
    instructions: `${RULES}\nFor each checklist area in the input, in the same order and with the area key exactly as given, write one sentence addressed to the candidate as "you": what to add when the area is not done, or how to make it clearer when it is done.`,
  },
  // M-067: why a job is recommended, as three reasons grounded on the evidence.
  whyRecommended: {
    kind: 'insights',
    schema: object({ reasons: { type: 'array', items: object({ title: text, text }) } }),
    instructions: `${RULES}\nGive exactly three reasons, in this order: listed skills, experience, work preferences and location. Each has a short title and one or two sentences addressed to the candidate as "you", grounded on the evidence block. Do not mention any score or percentage.
${VISA}`,
  },
  // M-062: a recruiter-ready summary of the candidate's own profile and live CV.
  profileSummary: {
    kind: 'profile_summary',
    schema: object({ summary: text }),
    instructions: `${RULES}\nWrite a recruiter-ready summary of this candidate in the third person: three to five sentences on role, experience, strongest skills and work preferences. No headings, no lists.`,
  },
  // Suggested replies under the latest message from the other side of a thread; the reader edits before sending.
  replySuggestions: {
    kind: 'reply_suggestions',
    schema: object({ replies: texts }),
    instructions: `${RULES}
Suggest exactly ${LIMITS.message.replySuggestions.count} short replies the reader ("you" in the input) could send next in this conversation between a candidate and a company. Each reply answers the latest message, in the reader's own voice, polite and professional, at most two sentences and 45 words.
Make them specific with the facts given: the job (title, location, work mode, salary, skills), the company, the candidate's profile (headline, years, skills, availability), and the company's open roles. A candidate may point to their own matching skills and experience; a recruiter may answer with the job's facts, including its responsibilities. Never ask the other side for something these facts already contain.
When job.inferred is true the conversation never named the job: it is the company's open role closest to the candidate, so name it naturally in the reply (for example "the Full Stack Developer role") so the other side can correct it, and never say how it was chosen.
Make the replies differ in intent (for example: say yes and move forward, ask one useful question the facts do not answer, decline politely or propose a next step).
Never state anything the facts or messages do not contain (no invented dates, times, salaries, availability, experience or contact details), and never use placeholders such as [name] or [date]; ask instead when a detail is needed.`,
  },
  // §3.23, P11d-Q5: notes of a recorded interview for the recruiter's company, from the transcript only.
  interviewNotes: {
    kind: 'interview_notes',
    schema: object({ summary: text, keyAnswers: texts, strengths: texts, concerns: texts, followUps: texts }),
    instructions: `${RULES}
You write interview notes for the recruiter from the transcript of a recorded job interview (both voices, unlabelled; tell interviewer and candidate apart from context). Give a summary of three or four sentences, up to six key answers the candidate gave (what was asked and what they answered), up to four strengths and up to four concerns, each tied to what was said, and up to four follow-up questions worth asking next. Use only what the transcript says; when it says too little for a list, return fewer items or none.`,
  },
  // M-144: user content in the reader's language.
  translate: {
    kind: 'translation',
    schema: object({ texts }),
    instructions: 'Translate each text of the input into the requested language, keeping its meaning, tone, names, numbers and line breaks. Return the same number of texts in the same order. A text already in that language is returned unchanged.',
  },
  // M-027: a profile snapshot proposed from the CV text; the candidate confirms it (P9-Q3).
  cvSnapshot: {
    kind: 'cv_snapshot',
    schema: snapshot,
    instructions: `${RULES}\nFrom the CV text, propose the candidate's current or target role title (at most ${LIMITS.profile.headline.max} characters), their total years of professional experience as a whole number, and up to ${LIMITS.profile.skills.max} professional skills of at most ${LIMITS.profile.skills.itemMax} characters each, as written in the CV.`,
  },
  // M-061: suggestions and a revised snapshot; no new file.
  cvDraft: {
    kind: 'cv_draft',
    schema: object({ suggestions: texts, revisedSnapshot: snapshot }),
    instructions: `${RULES}\nReview the CV text for a candidate improving it: give three to six concrete suggestions addressed to the candidate as "you" (clearer impact, grouped skills, missing context), and a revised snapshot (role at most ${LIMITS.profile.headline.max} characters, whole years, up to ${LIMITS.profile.skills.max} skills of at most ${LIMITS.profile.skills.itemMax} characters) that the CV supports.`,
  },
}
