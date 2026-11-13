/*
 * The public website's demo content (owner 2026-11-13): three blog posts with AI-generated editorial covers (no real
 * people) and six approved reviews by seeded people. `daysAgo` dates the post or the approval from the seed run.
 */
const IMAGES = 'client/src/assets/images'

export const BLOG_POSTS = [
  {
    title: '21 Job Interview Tips: How To Make a Great Impression',
    cover: `${IMAGES}/blog-interview-tips.jpg`,
    daysAgo: 3,
    excerpt: 'From the research you do the night before to the follow-up you send the next morning: a practical checklist for interviews in the EU and the UK.',
    body: `Interviews reward preparation far more than talent for small talk. Hiring teams across Europe tell us the same thing: the candidates who stand out are the ones who make the conversation easy. Here is the checklist we share with job seekers on EU Jobs.

## Before the interview

1. **Read the job post twice.** Underline the three responsibilities that appear first; they are usually what the team needs most.
2. **Study the company, not just the product.** Look at recent news, their engineering or design blog and how they describe their culture.
3. **Prepare three stories.** One about a result you are proud of, one about a mistake you fixed and one about working with someone difficult.
4. **Use the STAR shape** (situation, task, action, result) so every story ends with something measurable.
5. **Check the logistics.** Time zone, video link, building entrance and the name of your interviewer.
6. **Prepare your questions.** Two thoughtful questions show more interest than ten generic ones.
7. **Match your CV to the role.** On EU Jobs you can keep a version per application, so the recruiter sees the most relevant experience first.

## On the day

8. **Arrive or log in ten minutes early.** Test your camera, microphone and light if the call is remote.
9. **Open with a clear introduction.** Thirty seconds: who you are, what you do best and why this role.
10. **Listen to the whole question.** Pausing for two seconds before answering reads as confidence, not hesitation.
11. **Be specific.** "I reduced onboarding time from two weeks to four days" beats "I improved onboarding".
12. **Talk about the team.** Hiring managers want to know how you collaborate, not only what you shipped alone.
13. **Be honest about gaps.** Explain what you learned and how you closed them.
14. **Show how you think.** In a case or task, say your assumptions out loud.
15. **Mind the language.** If the interview is not in your first language, it is fine to ask for a question to be repeated.
16. **Ask about the next steps** before you finish, including the timeline.

## After the interview

17. **Send a short thank-you** within 24 hours, mentioning one thing you enjoyed discussing.
18. **Write down what you were asked.** Patterns appear quickly and make the next interview easier.
19. **Update your application status** so you always know where you stand.
20. **Ask for feedback** if you are not selected; many recruiters share a few lines when asked politely.
21. **Keep going.** Every interview is practice for the one that turns into an offer.

> The best interviews feel like two teams deciding whether to work together. Prepare so that you can enjoy that conversation.`,
  },
  {
    title: 'How to Land a Remote Job in the EU in 2026',
    cover: `${IMAGES}/blog-remote-eu.jpg`,
    daysAgo: 9,
    excerpt: 'Remote roles across Europe are competitive but open to great candidates anywhere. What recruiters look for, and how to set up your profile to be found.',
    body: `Remote hiring in Europe has settled into a clear pattern: companies still hire remotely, but they are more selective about time zones, legal setup and communication skills. The good news is that each of these is something you can show on your profile.

## Know the three kinds of "remote"

- **Fully remote within a country:** you must live and be allowed to work in one specific country.
- **Remote within the EU (or EU and UK):** the company employs people in several countries, often through an employer of record.
- **Remote with time-zone overlap:** location matters less than being online for the team's core hours.

Read the job post carefully. On EU Jobs every role shows its work mode and location, and you can filter by remote, hybrid or on-site.

## Make your right to work clear

Recruiters filter quickly when they are unsure whether they can employ you. Add your right-to-work status to your profile and keep your country and city up to date. A verified profile removes one more question before the first call.

## Show that you communicate well in writing

Remote teams run on written updates. Recruiters notice:

- A **clear, concise summary** at the top of your profile.
- **Specific results** in each role, written in short sentences.
- **Tools you use daily** to collaborate, such as shared documents, issue trackers and design files.

## Prepare for a remote interview loop

Expect a short screening call, a skills task or case study and a final conversation with the team. Treat the task like real work: state your assumptions, keep it within the suggested time and explain your trade-offs.

## Set up job alerts

The strongest remote roles close quickly. Create an alert for remote jobs in your field, choose instant or daily emails, and apply within the first few days.

> Remote is a way of working, not a perk. Show that you already work that way and recruiters will find you.`,
  },
  {
    title: 'Make Your CV Stand Out to AI Job Matching',
    cover: `${IMAGES}/blog-cv-ai-matching.jpg`,
    daysAgo: 16,
    excerpt: 'How AI matching reads your profile, why clear skills and recent experience matter most, and five quick edits that raise your match score.',
    body: `EU Jobs uses AI to match candidates and roles, but the goal is simple: help a recruiter see quickly why you fit. Matching reads your profile and CV the way a careful recruiter would, so the advice is the same for both.

## What matching looks at

- **Skills** listed on your profile, compared with the skills a job requires.
- **Your experience:** recent job titles, responsibilities and the results you describe.
- **Practical fit:** location, work mode and right to work.

Every match comes with an explanation, so you can see which skills counted and which ones were missing.

## Five edits that make a real difference

1. **List skills by their common names.** Write "Design systems" or "React", not internal tool names only your last team knew.
2. **Lead each role with results.** Start with what changed because of your work, then how you did it.
3. **Keep your most recent role detailed.** Matching and recruiters weigh recent experience most.
4. **Remove what no longer represents you.** A focused CV of two pages reads better than a complete history.
5. **Fill the gaps the explanation shows.** If a skill keeps appearing as missing, a short course and certificate on EU Jobs can close it.

## Keep a version per kind of role

If you apply for both product design and UX research roles, keep a CV version for each. EU Jobs stores your versions, and you choose which one to send with every application.

## Check your profile completeness

A complete profile is shown to more recruiters in candidate search. Add your photo or links, languages, education and a verified right to work, and keep your availability current.

> AI matching does not replace a recruiter's judgement. It makes sure your best experience is the first thing they see.`,
  },
]

/** Reviews by seeded people (found by name), approved `daysAgo`. */
export const REVIEWS = [
  { fullName: 'Emma Wilson', rating: 5, daysAgo: 1, text: 'The smart job recommendations saved me so much time. I did not even know some of these roles existed, and the match explanations told me exactly why.' },
  { fullName: 'Sarah Miller', rating: 5, daysAgo: 2, text: 'We filled two design roles in under three weeks. The pipeline is clear, the candidates are well matched and replying to applicants takes seconds.' },
  { fullName: 'Sofia Martinez', rating: 5, daysAgo: 4, text: 'I had been applying for months with no luck. Once I signed up here, I got multiple interview calls in just days. Totally worth it.' },
  { fullName: 'Lucas Meyer', rating: 4, daysAgo: 6, text: 'Verified profiles and right-to-work details up front save our team hours of screening every week. Scheduling interviews in the app is a big plus.' },
  { fullName: 'Daniel Kim', rating: 5, daysAgo: 8, text: 'Keeping a CV version per kind of role made a real difference. I always knew which version a company saw and where each application stood.' },
  { fullName: 'Aisha Patel', rating: 4, daysAgo: 11, text: 'The courses closed the skill gap that kept showing up in my matches. Two weeks later I had an offer for a remote research role.' },
]
