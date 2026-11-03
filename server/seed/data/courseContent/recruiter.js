/*
 * Seed lesson texts and quizzes of the six recruiter courses (M-209, U42): three English Markdown lessons of
 * 300–600 words and five single-choice questions each, written once and committed with the seed.
 */
export const RECRUITER_COURSE_CONTENT = {
  'hiring-technology-product-talent': {
    lessons: [
      {
        title: 'Mapping technical roles and disciplines',
        markdown: `## Why the map matters

Technology job titles travel badly. The same title can describe very different work in two companies, and two different titles can describe almost the same job. If you rely on titles alone, you will shortlist the wrong people and miss the right ones. A working map of disciplines lets you ask what the person actually does each day, which is the question that predicts fit.

## The main families

Most technology and product teams contain a handful of recurring disciplines. Learn what each one produces rather than which tools it uses:

- **Software engineering** builds and maintains the product. Front-end engineers work on what users see and touch, back-end engineers on services, data storage and integrations, and full-stack engineers across both.
- **Infrastructure and platform engineering** keeps systems running, deployable and secure, and builds internal tooling that other engineers depend on.
- **Data roles** split into engineering (moving and modelling data), analysis (answering business questions) and science or machine learning (building predictive models).
- **Quality engineering** designs tests and automation so changes can ship safely.
- **Product management** decides what to build and why, balancing customer needs, business goals and engineering effort.
- **Product design** shapes how the product works for users, from research to interface.
- **Security** protects systems and data and advises teams on risk.

## Seniority is about scope, not years

Within each family, levels usually describe the size of problem someone can own. A junior engineer completes well-defined tasks with guidance. A mid-level engineer delivers features independently. A senior engineer shapes the approach for a team and raises the standard of others’ work. Staff or principal roles influence several teams. Engineering managers own people and delivery, which is a different path rather than simply a promotion. Ask hiring managers which of these the role really needs, because a title such as senior can hide very different expectations.

## Ask about the work, not the label

When you take a brief, ask questions that reveal the real shape of the role:

1. What will this person build, run or decide in their first six months?
2. Who will they work with most closely each week?
3. Which problems are hard here, and why?
4. What does good look like at the end of the first year?

The answers often show that a role labelled one thing is closer to another, which changes where you search and how you describe it. You do not need to be an engineer to ask these questions well. You need curiosity, and the confidence to say that you want to understand the work properly before you start searching.

## Practical exercise

Pick three open technology roles in your current workload. For each, write one sentence describing the work in plain language, without the title or any tool names. Then check that sentence with the hiring manager and note anything they correct.`,
      },
      {
        title: 'Reading evidence in technical profiles',
        markdown: `## Keywords are not evidence

A profile that lists many tools tells you what a person has been near, not what they did. Keyword matching rewards people who write long lists and penalises people who describe their work plainly. It also misses transferable skills: someone who has built similar systems with a different tool can often adapt quickly. Your task is to look for evidence of outcomes, ownership and growth.

## What useful evidence looks like

Strong evidence usually answers three questions: what was the problem, what did this person do, and what changed as a result. Look for:

- **Ownership** – verbs such as designed, led, migrated or maintained, tied to something specific.
- **Context** – the size of the team, the type of product and the constraints they worked within.
- **Outcomes** – faster releases, fewer incidents, a feature adopted by customers, a process others now use.
- **Progression** – growing scope over time, such as moving from building features to shaping how a team builds them.
- **Shared work** – open-source contributions, talks, articles or portfolios, where relevant and offered by the candidate.

Treat public work as a bonus, not a requirement. Many excellent engineers have no public code because their work is private to their employer, or because caring responsibilities leave little spare time.

## Reading between the lines carefully

Some signals are easy to misread. A short tenure may reflect a closed company or a fixed-term project. A gap may reflect study, health or family. A general title may hide deep specialist work. Rather than guessing, note the question and ask it in a screening call. Phrase questions neutrally, for example: tell me about the system you spent most time on in that role.

## Questions that test depth

You do not need to judge technical answers in detail. You need to tell whether the candidate can explain their own work clearly. Useful prompts include:

1. Walk me through a recent piece of work you were proud of. What was your part?
2. What trade-offs did you consider, and what did you decide?
3. What went wrong, and what did you change afterwards?
4. If you did it again, what would you do differently?

Clear, specific answers with honest reflection are a good sign. Vague answers that stay at the level of the team, or that only repeat tool names, are worth probing gently before you pass the profile on. When you share a profile with an engineer, include the evidence you found and the open questions, so they can focus their review rather than starting from scratch.

## Practical exercise

Take two profiles you recently screened. For each, write down three pieces of evidence of ownership or outcome, and one open question you would need to ask. Compare this with your original keyword-based judgement and note where it changes.`,
      },
      {
        title: 'Writing clear role requirements',
        markdown: `## Start from outcomes

A requirement list copied from an old advert usually mixes essentials with wishes, and tool names with real skills. Start instead with what the person must achieve. Ask the hiring manager for three to five outcomes for the first year, then work backwards to the skills and experience that make those outcomes likely.

## Separate must-haves from nice-to-haves

Long lists of essentials shrink the pool and discourage capable people who meet most but not all criteria. Keep the essential list short and defensible. A good test for each item: would we really reject an otherwise strong candidate who lacks this? If not, it belongs under nice-to-have, or nowhere.

## Describe skills, not just tools

Tools change quickly, and people who know one can often learn a similar one. Write requirements that describe the capability, then name tools only where they truly matter. Compare:

- Weak: five years of experience with a particular framework.
- Stronger: experience building and maintaining web applications used by customers, ideally with a component-based front-end framework.

The stronger version tells candidates what the work involves and widens the pool without lowering the bar. Be cautious with year counts too. Years show exposure, not capability, and they can exclude people who progressed quickly or took career breaks.

## Make requirements assessable

Every essential requirement should be something you can find evidence for in a profile or test in an interview. If no one can say how they would recognise it, rewrite it. Phrases such as rock star, high energy or culture fit are vague, invite bias and cannot be assessed fairly. Replace them with behaviours: explains technical decisions clearly to non-specialists, or reviews colleagues’ code constructively.

## Agree the brief in writing

Once you and the hiring manager agree the requirements, record:

1. The outcomes for the first year.
2. The short list of essentials and how each will be assessed.
3. The nice-to-haves.
4. Who will interview, and which requirement each person covers.

This becomes the reference point for screening, interviewing and debriefing. When debate starts later, you can return to what was agreed rather than reopening the brief from memory. It also gives you a credible basis for conversations with engineers: you are not claiming to be the expert, you are holding everyone to the standard they set together.

## Practical exercise

Choose one live technology role. Rewrite its requirements using the steps above: outcomes first, a short essential list, skills described as capabilities, and a note of how each essential will be assessed. Share the draft with the hiring manager and record what changed.`,
      },
    ],
    quiz: [
      {
        text: 'When taking a brief for a technical role, which question best reveals the real shape of the role?',
        options: [
          'Which tools should we list in the advert?',
          'What will this person build, run or decide in their first six months?',
          'How many years of experience should they have?',
          'Which job title do other companies use for it?',
        ],
        correct: 1,
      },
      {
        text: 'According to the course, what do seniority levels within a technical discipline mainly describe?',
        options: [
          'The number of years someone has worked',
          'The number of tools someone has used',
          'The size of problem someone can own',
        ],
        correct: 2,
      },
      {
        text: 'Why is keyword matching weak evidence when reading a technical profile?',
        options: [
          'It shows what someone has been near, not what they did',
          'It takes too long to complete for each profile',
          'It only works well for senior engineering roles',
          'It gives too much weight to job titles',
        ],
        correct: 0,
      },
      {
        text: 'A candidate for an engineering role has no public code. How should you treat this?',
        options: [
          'As a reason to reject the profile at screening',
          'As a sign that they lack technical depth',
          'As neutral, since much good work is private',
          'As a reason to ask for unpaid project work',
        ],
        correct: 2,
      },
      {
        text: 'Which is the best test for whether a role requirement is truly essential?',
        options: [
          'Did it appear in the previous advert for this role?',
          'Does the hiring manager mention it first in the brief?',
          'Is it a widely used tool in the current market?',
          'Would we really reject an otherwise strong candidate who lacks it?',
        ],
        correct: 3,
      },
    ],
  },
  'structured-interviewing-better-evidence': {
    lessons: [
      {
        title: 'Defining competencies before the interview',
        markdown: `## Why decide first

If interviewers decide what they are looking for during the conversation, each one ends up assessing something different. One looks for confidence, another for technical detail, a third for whether they would enjoy working with the person. The result is evidence that cannot be compared. Agreeing competencies in advance gives every interviewer the same target.

## From role requirements to competencies

A competency is a skill or behaviour that predicts success in the role and can be observed. Start with the agreed role requirements and the outcomes expected in the first year. For each outcome, ask what the person would need to do well to achieve it. Group those into a small set, usually four to six. With more than that, interviews become rushed and shallow.

Examples might include:

- Planning and prioritising work under changing deadlines.
- Explaining complex information to different audiences.
- Building working relationships with stakeholders.
- Solving unfamiliar problems using data and judgement.

## Define what good looks like

A label alone is not enough. Write a short description of what strong, acceptable and weak evidence would look like for each competency. For stakeholder relationships, strong evidence might be a specific example of resolving a disagreement by understanding the other party’s goals. Weak evidence might be general statements about being a people person, with no example.

These descriptions become your rating guide. They help interviewers score against the role rather than against each other or against their own preferences.

## Build the interview plan

With competencies defined, decide who covers what:

1. Assign each competency to one or two interviewers, so nothing is missed and nothing is assessed five times.
2. Decide which stage assesses it: screening, a skills exercise, a panel or a final conversation.
3. Allocate time realistically; exploring one meaningful example properly usually takes longer than people expect.
4. Share the plan and rating guide with every interviewer before the first candidate.

## Keep it proportionate

A structured plan does not need to be long. One page per role is usually enough. The aim is clarity, not bureaucracy. If interviewers ignore the plan because it is too complex, simplify it. A short plan that everyone uses produces better evidence than a detailed one that sits unread.

## Practical exercise

For one role you are hiring, list the first-year outcomes, derive four to six competencies, and write one line each for strong and weak evidence. Then draft an interview plan showing who covers which competency at which stage, and ask one interviewer whether it is clear.`,
      },
      {
        title: 'Building behavioural and situational questions',
        markdown: `## Two question types

Behavioural questions ask about what someone has done: tell me about a time when something specific happened. They rest on the idea that past behaviour in similar situations is a reasonable guide to future behaviour. Situational questions ask what someone would do in a realistic scenario from the role. They are useful when candidates may not have had the exact experience yet, for example in early-career hiring or career changes.

Both work best when tied to a defined competency and asked consistently of every candidate.

## Writing a behavioural question

A good behavioural question is specific enough to draw out a real example and open enough not to suggest an answer. Compare:

- Weak: are you good at handling conflict?
- Stronger: tell me about a time you disagreed with a colleague about how to approach a piece of work. What happened, and what did you do?

The weak version invites a simple yes. The stronger version asks for a story you can examine.

## Writing a situational question

Base the scenario on something that actually happens in the role. Give enough detail to make it realistic, and include a genuine tension so there is no single obvious answer. For example: two stakeholders ask you for urgent work on the same day, and you can only finish one. How would you decide, and what would you tell each of them?

## Follow-up probes

The first answer is rarely the full picture. Prepare neutral probes that help candidates give specific detail:

- What was your role, specifically?
- What did you do next?
- How did you know it had worked?
- What would you do differently now?

Use probes to deepen the answer, not to lead it. Avoid hints such as “So you escalated it, right?”, which tell the candidate what you want to hear.

## Consistency without a script

Ask every candidate the same core questions in a similar order, so their answers can be compared. You can still adapt your tone, put people at ease and follow up naturally. Structure is about the questions and the rating guide, not about reading aloud without warmth.

Tell candidates at the start how the interview will run, including that you will take notes and ask follow-up questions. This helps people who are nervous or less familiar with the format, and it means the structure works for the candidate as well as for you.

## Practical exercise

For two competencies in your current interview plan, write one behavioural question, one situational question and three follow-up probes each. Test them on a colleague and note whether the questions produce specific examples or general claims.`,
      },
      {
        title: 'Taking objective, candidate-aware notes',
        markdown: `## Why notes matter

Memory is unreliable, especially after a day of interviews. Without notes, debriefs rely on overall impressions, and the loudest or most senior voice often wins. Good notes let the panel compare candidates on evidence and let you explain a decision later.

## Record what was said, not what you felt

Write down what the candidate described: the situation, what they did, and the result. Use their words where you can. Keep interpretation separate and clearly marked. For example:

- Evidence: described rebuilding the onboarding process after feedback from new starters; said they spoke to recent hires and changed the first-week schedule.
- Interpretation: strong example of acting on feedback.

Avoid labels that describe personality or appearance rather than evidence, such as nervous, polished, a good fit or not our type. These invite bias and say nothing about the competency.

## Stay present with the candidate

Note-taking should not turn the interview into a checklist. A few practices help:

1. Tell the candidate at the start that you will take notes so you can remember their examples accurately.
2. Write short phrases during the conversation, then complete them straight after.
3. Look up regularly and leave pauses so the candidate can think.
4. If you are interviewing in a pair, agree who leads questions and who takes fuller notes.

## Rate after, not during

Score each competency against the rating guide once the interview is over and before you speak to other interviewers. Independent scoring protects against anchoring, where the first opinion shared shapes everyone else’s. Each score should point to evidence in your notes.

## The balanced debrief

In the debrief, the facilitator, often the recruiter, keeps the discussion anchored on evidence:

- Go competency by competency rather than candidate by gut feel.
- Ask each interviewer to share their score and evidence before open discussion.
- Challenge unsupported claims politely: what did the candidate say that led you to that view?
- Note gaps where no one gathered evidence, rather than filling them with assumptions.

## Handle notes with care

Interview notes are personal information about candidates. Keep them factual, store them only in agreed systems, and follow your organisation’s policies on access and retention. Write every note as if the candidate might one day read it.

## Practical exercise

Review your notes from a recent interview. Mark each line as evidence or interpretation, and rewrite any personality labels as observed behaviour. Then practise one debrief challenge question you could use when a colleague gives an opinion without evidence.`,
      },
    ],
    quiz: [
      {
        text: 'Why should competencies be agreed before interviews begin?',
        options: [
          'So every interviewer assesses the same things and evidence can be compared',
          'So interviews can be shortened to a few minutes each',
          'So candidates can be sent model answers in advance',
          'So the hiring manager can skip the debrief entirely',
        ],
        correct: 0,
      },
      {
        text: 'How many competencies does the course suggest for a typical interview plan?',
        options: ['Two or fewer', 'Four to six', 'Ten to twelve', 'Every item in the role description'],
        correct: 1,
      },
      {
        text: 'Which is the strongest behavioural interview question?',
        options: [
          'Are you good at handling conflict at work?',
          'Would you describe yourself as a team player?',
          'Tell me about a time you disagreed with a colleague on an approach.',
          'How do you usually feel about conflict in a team?',
        ],
        correct: 2,
      },
      {
        text: 'Why should interviewers score candidates before speaking to other interviewers?',
        options: [
          'To finish the debrief more quickly',
          'To let the most senior interviewer decide',
          'To avoid having to keep written notes',
          'To protect against anchoring on the first opinion shared',
        ],
        correct: 3,
      },
      {
        text: 'In a debrief, a colleague says a candidate “just isn’t sharp enough”. What is the best facilitator response?',
        options: [
          'Accept it, since the colleague has more experience',
          'Ask what the candidate said that led to that view',
          'Move straight on to the next candidate',
        ],
        correct: 1,
      },
    ],
  },
  'fair-hiring-inclusive-selection': {
    lessons: [
      {
        title: 'Where bias enters the process',
        markdown: `## Bias is a process problem

Most unfair hiring outcomes are not caused by people setting out to treat others unfairly. They come from mental shortcuts that everyone uses when tired, busy or uncertain. Because these shortcuts are human, the most reliable fix is not to try harder but to design a process that reduces the room for them.

## Common points of entry

Bias can appear at every stage. Watch for it in particular here:

- **The brief** – requirements copied from the last person in the role, or criteria such as specific schools, unbroken careers or long experience that the work does not need.
- **The advert** – language that signals who belongs, unnecessary demands, or unclear information about flexibility and adjustments.
- **Sourcing** – searching only in the same networks and referral pools that produced the current team.
- **Screening** – reacting to names, photos, addresses, accents in a phone call, or gaps in a career history.
- **Interviewing** – unstructured conversations where rapport and similarity carry more weight than evidence.
- **Decision-making** – debriefs led by the most senior voice, and vague ideas such as fit used without definition.

## Shortcuts to recognise

A few patterns appear again and again:

1. **Affinity** – warming to people who share our background, interests or style.
2. **First impressions** – letting the first minutes or the first page shape everything that follows.
3. **Halo and horns** – one strong positive or negative feature colouring the whole assessment.
4. **Confirmation** – noticing evidence that supports an early view and overlooking evidence against it.
5. **Contrast** – judging a candidate against the previous one rather than against the criteria.

Naming these patterns helps teams catch them in the moment, without blaming anyone for being human.

## What helps

The practices covered in this course work by narrowing discretion where it does not add value:

- Agree criteria before you see any applications.
- Apply the same criteria in the same way to every candidate.
- Use structured questions and rating guides at interview.
- Score independently before discussing.
- Record reasons for decisions in terms of the criteria.

None of these remove judgement. They make judgement visible and comparable, so it can be checked and explained.

## Practical exercise

Walk through one recent hiring process from brief to decision. At each stage, note one point where a shortcut could have influenced the outcome, and one practical change that would reduce the risk next time. Share the list with a colleague and compare what each of you spotted.`,
      },
      {
        title: 'Writing criteria before you screen',
        markdown: `## Why timing matters

If you decide what you are looking for after you have read the applications, the criteria tend to shape themselves around the candidates you already like. Writing criteria first gives every applicant the same target and gives you something to check your decisions against.

## What good criteria look like

Strong screening criteria are:

- **Job-related** – they come directly from the work and the agreed outcomes for the role.
- **Few** – usually three to six essentials, so screeners can apply them consistently.
- **Observable** – you can point to evidence in an application or CV.
- **Inclusive in wording** – they describe capability rather than one particular route to it.

Compare a criterion such as degree from a top university with one such as able to analyse data and present findings to non-specialists. The first describes a background. The second describes what the job needs and allows people who learned it in different ways to show it.

## Watch for proxy criteria

Some criteria look neutral but act as stand-ins for things that are not relevant to the job. Continuous employment, a set number of years, particular hobbies, a local address, or native-level language when the role does not need it can all screen out capable people for reasons unrelated to the work. For each criterion, ask: is this the skill we need, or a proxy for it? If it is a proxy, name the real skill instead.

## Define the evidence levels

For each criterion, write a short note on what counts as meets, partly meets and does not meet. For example, for stakeholder communication:

1. Meets – a clear example of explaining work to people outside their own team.
2. Partly meets – mentions working with other teams but gives little detail.
3. Does not meet – no evidence in the application.

These descriptions make it far easier for two screeners to reach the same view on the same application.

## Agree and record

Share the criteria with the hiring manager and anyone else who will screen, and agree them in writing before the advert goes live. If criteria need to change later, record the change and the reason, and apply the new version to every applicant, including those already reviewed. Changing the rules for some candidates and not others is one of the quickest ways to make a process unfair.

## Practical exercise

Take one open role and write three to six screening criteria using the guidance above. For each, check whether it is a real requirement or a proxy, and write the three evidence levels. Ask a colleague to apply your criteria to two sample applications and compare your results.`,
      },
      {
        title: 'Reviewing applications consistently',
        markdown: `## Consistency is the goal

Fair screening does not mean treating every application identically in every detail. It means applying the same criteria, in the same way, with the same standard of evidence, to everyone. That is what allows you to explain why one person progressed and another did not.

## Set up before you start

A little preparation makes consistent review much easier:

- Keep the agreed criteria and evidence levels open while you review.
- Use a simple scoring sheet with one column per criterion and a space for notes.
- Where your tools allow, hide details that are not needed for the first screen, such as names, photos or dates of birth.
- Block focused time; reviewing in short bursts between meetings encourages shortcuts.

## Review criterion by criterion

Read each application against the criteria rather than forming an overall impression first. For each criterion, note the evidence and the level it reaches. When the evidence is unclear, record that rather than guessing. Avoid giving extra credit for things outside the criteria, such as a well-known former employer or an attractive layout, and avoid penalising things that do not affect the work, such as an unusual career path.

## Check yourself as you go

Fatigue and order effects are real. A strong application can make the next one look weak by contrast, and the last applications of the day may get less attention than the first. Simple checks help:

1. Take short breaks and avoid reviewing large batches in one sitting.
2. Revisit your first few scores at the end to see whether your standard drifted.
3. Ask a colleague to second-review a sample, including some you rejected.
4. Compare who progressed with who applied, and ask why if the patterns differ sharply.

## Record decisions clearly

For every decision, write a short reason that refers to the criteria, for example: does not meet criterion two; no evidence of managing budgets. Avoid comments such as not a fit or weak profile, which cannot be reviewed or explained. Clear records protect candidates, help hiring managers trust the shortlist and make it possible to learn from the process.

## Treat candidates as people

Behind each application is someone waiting for an answer. Respond in a reasonable time and, where you can, give a short honest reason when you decline. Consistency and respect go together.

## Practical exercise

Choose ten applications from a recent role. Re-score them using a criterion-by-criterion sheet, then compare with the original decisions. Note any differences and what caused them, and agree one change to how your team reviews applications.`,
      },
    ],
    quiz: [
      {
        text: 'According to the course, where do most unfair hiring outcomes come from?',
        options: [
          'Deliberate attempts to exclude certain people',
          'Mental shortcuts people use when tired, busy or uncertain',
          'Candidates presenting themselves poorly on paper',
        ],
        correct: 1,
      },
      {
        text: 'Judging a candidate against the previous candidate rather than against the criteria is an example of which shortcut?',
        options: ['Affinity', 'Halo and horns', 'Contrast', 'Confirmation'],
        correct: 2,
      },
      {
        text: 'Why should screening criteria be written before you read any applications?',
        options: [
          'So the criteria do not shape themselves around candidates you already like',
          'So the advert can be published without the hiring manager’s review',
          'So screening can be skipped for referred candidates',
          'So every shortlist contains the same number of people',
        ],
        correct: 0,
      },
      {
        text: 'Which screening criterion is most likely to be a proxy rather than a real requirement?',
        options: [
          'Can present findings clearly to non-specialists',
          'Can analyse data to answer business questions',
          'Can plan work to meet agreed deadlines',
          'Has an unbroken employment history',
        ],
        correct: 3,
      },
      {
        text: 'Which is the best recorded reason for declining an application?',
        options: [
          'Not quite the right fit for our team at this stage',
          'Profile felt weaker than others in the same batch',
          'No evidence of managing budgets, which is criterion two',
          'Did not come across as confident in the application',
        ],
        correct: 2,
      },
    ],
  },
  'talent-strategy-workforce-planning': {
    lessons: [
      {
        title: 'Reading the business plan',
        markdown: `## Hiring follows strategy

Recruiting teams that only react to requisitions are always behind. By the time a role is approved, the business need may already be urgent. Reading the business plan lets you see demand coming, prepare pipelines and give leaders realistic advice about what is achievable.

## What to look for

Business plans, budgets and leadership updates rarely mention hiring directly, but they contain the signals you need:

- **Growth goals** – new markets, products, customer segments or revenue targets that will need people.
- **Changing priorities** – areas being scaled back, merged or automated, which may free people or reduce demand.
- **Capability shifts** – new skills the organisation needs, such as data, security or languages for new markets.
- **Timelines** – when launches, openings or contract starts are expected.
- **Constraints** – budget limits, location policies or approval processes that affect how quickly roles can be filled.

## Translate goals into capability questions

For each major goal, ask what work it creates and who will do it. Avoid jumping straight to headcount. A plan to enter a new country might be met by hiring locally, moving existing staff, using partners or a mix. Useful questions for leaders include:

1. What must be true in twelve months for this goal to succeed?
2. Which capabilities do we already have, and which are missing?
3. Is this need permanent, temporary or still uncertain?
4. What happens if the roles are filled later than planned?

## Build the conversation, not just the document

The best insight comes from talking to the people who own the plan. Meet regularly with finance and department leaders, ask them what is changing, and share what you see in the market. Bring evidence such as recent time to fill for similar roles, the depth of candidate pools in particular locations, or competing demand inside the business. This positions recruiting as a partner in planning rather than an order-taker.

## Keep it current

Plans change. Revisit your reading at least each quarter or after any major decision, and note what has moved. A short summary of business priorities and their hiring implications, kept up to date, is far more useful than a detailed document that is out of date. Share that summary with your recruiting team too, so everyone understands why some roles matter more than others.

## Practical exercise

Take your organisation’s most recent plan or leadership update. List three goals, and for each one write the capabilities it will need, the likely timing, and one question you would ask its owner. Arrange a short conversation with one of those owners to test your reading.`,
      },
      {
        title: 'Forecasting hiring demand',
        markdown: `## Why forecast

A forecast is not a promise. It is a structured estimate of how many people, with which skills, the organisation is likely to need over a period. It helps you plan recruiter capacity, start sourcing early for difficult roles and warn leaders when plans and capacity do not match.

## Two sources of demand

Hiring demand usually comes from two places:

- **Growth** – new roles created by the business plan, such as expanding a team or opening a location.
- **Replacement** – roles that become vacant through people leaving, internal moves, promotions, parental leave or retirement.

Replacement demand is often underestimated because it is less visible. Use your own organisation’s history of leavers and internal moves by team as a starting point, adjusted for anything that has changed.

## Building a simple forecast

A practical forecast does not need complex modelling. For each team or role family:

1. Start with current headcount and planned headcount at the end of the period.
2. Add expected replacement demand, based on your own historical patterns.
3. Subtract roles likely to be filled by internal moves, where that is realistic.
4. Spread the result across the period according to when people are needed, not when roles will be approved.
5. Work backwards from your typical time to fill for similar roles to see when hiring must start.

## Use ranges and scenarios

Forecasts built on single numbers create false confidence. Use a likely case plus a lower and a higher case, and state the assumptions behind each. For example: the higher case assumes the second product launch goes ahead in the spring. When an assumption changes, update the forecast and tell stakeholders what it means.

## Turn demand into capacity

Compare forecast demand with what your team can realistically deliver. Recruiter workload depends on role difficulty, not just count: a handful of scarce specialist roles can take more effort than many high-volume roles. Where demand exceeds capacity, raise it early and offer options, such as reprioritising, extending timelines, using external partners for some roles or developing internal talent.

## Review and learn

Compare forecasts with what actually happened each quarter. Where you were wrong, ask why: a missed signal in the plan, an unexpected wave of leavers, or a change in priorities. Each review makes the next forecast more credible, and leaders learn to trust the numbers because they understand how they were built.

## Practical exercise

Choose one team and build a simple forecast for the next two quarters using the steps above. Include a likely, lower and higher case with clear assumptions, and estimate when hiring would need to start. Review it with the team’s leader and note what they adjust.`,
      },
      {
        title: 'Prioritising scarce roles',
        markdown: `## Not every role is equal

When demand exceeds capacity, treating every vacancy as equally urgent means the most important roles wait in the same queue as the least important. Prioritisation is a business decision. Recruiting’s job is to make the trade-offs clear and help leaders choose.

## A simple prioritisation lens

Assess each role on a few agreed factors:

- **Business impact** – how directly the role affects revenue, customers, safety or a key goal.
- **Cost of delay** – what happens if the role is filled one or two quarters later.
- **Scarcity** – how hard the skills are to find in the relevant locations.
- **Alternatives** – whether the work could be covered by internal moves, development, contractors or a redesign of the role.

Score each factor on a simple scale with stakeholders. Roles with high impact, high cost of delay and few alternatives rise to the top. Scarce roles with low impact may need a different approach, not more effort.

## Options for scarce roles

For truly scarce skills, recruiting harder is rarely enough. Consider:

1. Widening the search to adjacent skills and training the gap.
2. Reviewing location, remote or relocation options with the business.
3. Developing internal people into the role over time.
4. Building long-term relationships with potential candidates before roles open.
5. Splitting the role, so scarce skills are focused where they matter most.

## Reporting with context

Counts alone mislead. Reporting that a number of roles were filled says nothing about whether they were the right ones. Report recruiting performance in the context of priorities and difficulty:

- Progress on top-priority roles, shown separately from the rest.
- Time to fill compared with what is typical for similar roles, with reasons for outliers.
- Quality signals, such as hiring manager feedback and early retention, where available.
- Candidate experience signals, such as response times.
- Risks and decisions needed, for example roles at risk of missing their need date.

Explain what the numbers mean and what you recommend. A short narrative helps leaders act.

## Revisit priorities regularly

Priorities shift as plans change. Review the priority list with stakeholders on a regular rhythm, such as monthly, and record changes and their reasons. This avoids silent reprioritisation, where roles drift without anyone deciding.

## Practical exercise

List your current open roles and score each on impact, cost of delay, scarcity and alternatives. Identify the top five, and one role where an alternative to external hiring could work. Draft a one-page update for leaders that reports progress on those priorities with context, not just counts.`,
      },
    ],
    quiz: [
      {
        text: 'What is the main benefit of reading the business plan as a recruiter?',
        options: [
          'Seeing demand coming and giving leaders realistic advice early',
          'Approving the hiring budget for each department',
          'Replacing regular conversations with department leaders',
          'Setting the final salary for every open role',
        ],
        correct: 0,
      },
      {
        text: 'Which source of hiring demand is often underestimated because it is less visible?',
        options: [
          'Growth from new products and markets',
          'Replacement from leavers and internal moves',
          'New roles created for a new location',
        ],
        correct: 1,
      },
      {
        text: 'Why does the course recommend ranges and scenarios in a hiring forecast?',
        options: [
          'They remove the need to state any assumptions',
          'They guarantee that the forecast will be accurate',
          'They avoid the false confidence of single numbers',
          'They make the forecast quicker to present',
        ],
        correct: 2,
      },
      {
        text: 'A role needs scarce skills but has low business impact. What does the course suggest?',
        options: [
          'Make it the top priority because it is the hardest',
          'Remove it from all recruiting reports',
          'Assign it to the least experienced recruiter',
          'Consider a different approach rather than more effort',
        ],
        correct: 3,
      },
      {
        text: 'Which is the most meaningful way to report recruiting performance to leaders?',
        options: [
          'Total roles filled this quarter, with no further detail',
          'Progress on priority roles, with context and risks',
          'Number of applications received for each advert',
          'Number of interviews held by each recruiter',
        ],
        correct: 1,
      },
    ],
  },
  'employer-brand-candidate-experience': {
    lessons: [
      {
        title: 'Telling the truth about the role',
        markdown: `## Why honesty works

Candidates compare what you say with what they experience, from the first message to their first months in the job. When the two do not match, people withdraw, decline offers or leave early, and they tell others. Honest, specific messaging attracts people who want the job as it really is.

## Generic claims say nothing

Many adverts describe a fast-paced, dynamic environment with a great culture and exciting opportunities. These phrases appear everywhere, so they tell candidates nothing and can sound evasive. Replace them with specifics:

- Instead of fast-paced, say what the pace looks like: a release every week, or busy seasons in spring and autumn.
- Instead of great culture, describe how the team works: how decisions are made, how people are supported, what flexibility exists.
- Instead of exciting opportunities, name the problems the person will work on.

## Include the hard parts

Every role has challenges. A realistic preview includes them: older systems, a team that is still forming, travel, out-of-hours cover or ambitious targets. Candidates who know about these and still apply are more likely to stay. Those who would not enjoy them can opt out early, which saves time for everyone.

Being honest about challenges is not the same as being negative. Pair each challenge with the support that exists or what is changing.

## Share the practical details

Candidates make decisions based on practical information, and missing details create doubt. Where your organisation allows, be clear about:

1. The pay range, or how pay is set.
2. Location, remote or hybrid arrangements and expectations for office time.
3. Working hours and any shift or on-call duties.
4. The selection process, its stages and likely timescales.
5. How to request adjustments during the process.

## Check your messaging against reality

Before publishing, ask people currently doing similar work to read the advert or careers content. Ask what feels accurate, what is missing and what they would not recognise. Hiring managers sometimes describe the role they wish existed rather than the one that does; current employees help keep it grounded.

## Keep it consistent

Your adverts, careers pages, outreach messages and interviews should tell the same story. If interviewers describe a different role from the advert, candidates notice. Brief interviewers on the agreed description and the honest challenges, so they can speak about them openly.

## Practical exercise

Choose one current advert. Highlight every generic phrase and replace it with a specific fact. Add one honest challenge with the support that comes with it, and fill in any missing practical details. Ask a current team member to review the result.`,
      },
      {
        title: 'Writing outreach people answer',
        markdown: `## Outreach is a first impression

A message to a potential candidate is often their first contact with your organisation. Generic, copied messages are easy to ignore and can damage how people see you. Personal, clear and respectful outreach is more likely to be answered, even when the answer is not now.

## Do your homework

Before writing, spend a few minutes understanding the person:

- What do they do now, and what have they done before?
- What in their experience connects to this role?
- Have they shared anything professionally relevant about their interests or goals?

Use only information they have chosen to make public and that relates to their work. Do not refer to personal details that would feel intrusive.

## Structure of a good message

Keep it short enough to read comfortably on a phone. A simple structure works well:

1. **Why them** – one specific reason you are contacting this person, drawn from their experience.
2. **What the role is** – the work, the team and the problem, in a sentence or two.
3. **What matters to them** – honest practical details such as location, working pattern or pay range, where you can share them.
4. **A clear, low-pressure ask** – for example, a short call, or a reply if they would like more details.

Avoid long lists of requirements, heavy praise for the company or urgency that is not real.

## Respect people’s time and choices

A considerate approach builds trust:

- Make it easy to say no, and thank people who decline.
- Follow up once if there is no reply, then stop.
- If someone says not now, ask whether you may contact them again later, and record their preference.
- Handle any personal data you hold in line with your organisation’s policies.

## Write in plain language

Use short sentences and everyday words. Avoid internal jargon, abbreviations and job-title codes that mean nothing outside your organisation. In multilingual markets, consider whether the message should be written in the candidate’s working language.

## Learn from replies

Track which messages get replies and which do not, and look at what differs: the opening line, the level of detail, the ask. Share what works with your team. Over time, this learning is more useful than any template.

## Practical exercise

Write outreach messages for three potential candidates for one role, using the four-part structure. Make the why-them line different and specific for each. Ask a colleague to read them and say which they would answer, and why.`,
      },
      {
        title: 'Mapping the candidate journey',
        markdown: `## See it from the other side

Recruiters see the process as a set of stages and tasks. Candidates experience it as a sequence of moments: seeing an advert, applying, waiting, talking to people, waiting again and receiving a decision. Mapping the journey from the candidate’s point of view shows where it feels confusing, slow or careless.

## Draw the map

List every step from first contact to final decision, and for each one note:

- What the candidate does.
- What the candidate hears from you, and when.
- Who is responsible on your side.
- How long the step usually takes.
- Where the candidate is waiting without knowing what happens next.

Include the less visible steps, such as scheduling, assessments, reference checks and offer approval. These often hide the longest waits.

## Remove silent waiting

Silence is one of the most common frustrations for candidates. People assume the worst when they hear nothing. Practical fixes include:

1. Telling candidates at the start what the stages are and roughly how long each takes.
2. Agreeing internal response times for each stage, such as how soon interviewers give feedback.
3. Sending a short update when there is a delay, even if there is no decision yet.
4. Setting reminders for candidates who have not heard from you within the agreed time.

## Close the loop with everyone

Every candidate who applies deserves an answer, including those you do not progress. Rejection messages should be timely, clear and respectful. Where you can, include a brief honest reason linked to the criteria. For candidates who reached interview, offer short feedback if your organisation allows it, and keep it factual and focused on the role requirements.

Thank people for their time. A respectful rejection keeps the door open for future roles and shapes how people talk about you.

## Make the process accessible

Check each step for barriers. Can candidates request adjustments easily? Do assessments work on a phone? Are instructions clear for people new to your process? Small changes here widen your pool and improve everyone’s experience.

## Ask candidates

Collect short feedback from candidates at key points, including those who were not successful. Ask what was clear, what was confusing and what would have helped. Look for patterns rather than single comments, and share them with hiring teams.

## Practical exercise

Map the journey for one role from advert to decision, marking every point where a candidate waits without an update. Choose the two longest silent waits and agree a specific fix for each with the hiring team. Then draft a respectful rejection message that includes a criteria-based reason.`,
      },
    ],
    quiz: [
      {
        text: 'Why does the course suggest replacing phrases such as fast-paced and great culture?',
        options: [
          'They are too long for most job adverts',
          'They tell candidates nothing specific',
          'They should be kept for senior roles only',
        ],
        correct: 1,
      },
      {
        text: 'What is the main benefit of including the hard parts of a role in your messaging?',
        options: [
          'Candidates who still apply are more likely to stay',
          'It allows you to skip the interview stage',
          'It makes the advert noticeably shorter',
          'It deters everyone except senior applicants',
        ],
        correct: 0,
      },
      {
        text: 'What should a good outreach message open with?',
        options: [
          'A full list of the role requirements',
          'A summary of the company’s history',
          'A specific reason you are contacting this person',
          'A short deadline to create a sense of urgency',
        ],
        correct: 2,
      },
      {
        text: 'A potential candidate has not replied to your outreach. What does the course recommend?',
        options: [
          'Send weekly reminders until they reply',
          'Contact them through their current employer',
          'Mark them as unsuitable in your records',
          'Follow up once, then stop',
        ],
        correct: 3,
      },
      {
        text: 'Which practice best removes silent waiting from the candidate journey?',
        options: [
          'Waiting until a final decision before contacting anyone',
          'Sending a short update whenever there is a delay',
          'Only contacting candidates who are progressing',
        ],
        correct: 1,
      },
    ],
  },
  'recruiting-leadership-team-coaching': {
    lessons: [
      {
        title: 'Setting quality standards',
        markdown: `## Why standards matter

Without shared standards, each recruiter works to their own idea of good. Some shortlists are carefully evidenced, others are a list of names. Some candidates hear back within days, others wait weeks. Clear standards make quality visible, give recruiters a fair basis for feedback and help hiring managers know what to expect.

## Choose a few standards that matter

Standards work best when they are few, specific and linked to outcomes. Cover the main parts of the work, for example:

- **Briefs** – every role has an agreed brief with outcomes, essential criteria and an interview plan before sourcing starts.
- **Shortlists** – each shortlisted candidate comes with a short evidence summary against the criteria.
- **Candidate communication** – every candidate receives an update or decision within an agreed number of working days at each stage.
- **Records** – decisions are recorded with criteria-based reasons in the agreed system.
- **Hiring manager partnership** – regular check-ins on each active role, with agreed actions.

Write each standard as something observable. Communicate promptly is vague. Every interviewed candidate receives an outcome within an agreed number of working days is checkable.

## Build them with the team

Standards imposed without discussion tend to be followed on paper only. Involve recruiters in drafting them. Ask what good looks like in their own best work, what gets in the way and what hiring managers value most. This builds ownership and surfaces practical constraints, such as systems or workload, that you may need to fix first.

## Make standards visible and measurable

For each standard, decide how you will know whether it is being met. Some can be checked from system data, such as time to respond. Others need sampling, such as reviewing a few shortlists or rejection messages each month. Keep measures simple; the goal is to learn and improve, not to create a surveillance system.

## Balance quality and workload

Standards that cannot be met with current workloads create stress and quiet corner-cutting. If a standard is regularly missed across the team, treat it as a signal about capacity or process, not only about individual performance. Adjust the workload, the process or the standard, and explain the decision to the team.

## Review regularly

Revisit standards every few months. Ask whether they still reflect what matters, whether they are realistic, and whether any are being met in form but not in spirit.

## Practical exercise

Draft four or five quality standards for your team covering briefs, shortlists, candidate communication and records. Write each as an observable behaviour and add how it will be checked. Discuss the draft with your team and note the changes they suggest.`,
      },
      {
        title: 'Coaching with evidence',
        markdown: `## Coaching is not telling

Coaching helps recruiters improve their own judgement and skills. It works best when it is grounded in specific evidence from their work, focused on a few areas at a time and shaped as a two-way conversation. Telling someone what to do may fix one problem; coaching helps them solve the next one themselves.

## Gather evidence first

General impressions such as needs to be more proactive are hard to act on. Before a coaching conversation, look at real examples:

- A brief they took and the shortlist that followed.
- Outreach messages and the replies they received.
- Interview notes and a debrief they facilitated.
- Candidate updates and rejection messages.
- Feedback from hiring managers and candidates.

Look for patterns across several examples rather than drawing conclusions from one.

## Give specific feedback

Effective feedback describes the situation, the behaviour you observed and its impact. For example: in Tuesday’s debrief, when the hiring manager said the candidate lacked energy, you moved on without asking for evidence, and the panel rejected the candidate without discussing the competencies. This is specific, factual and linked to an outcome, and it avoids judging the person.

Recognise what is working with the same specificity. Knowing exactly what to keep doing is as useful as knowing what to change.

## Ask before advising

Good coaching conversations rely on questions:

1. How do you think that went?
2. What were you trying to achieve?
3. What else could you have tried?
4. What would help you do that next time?

Let the recruiter reflect and propose options before you offer your view. Their own ideas are more likely to stick.

## Agree a small number of actions

End with one or two clear actions, for example practising a debrief challenge question in the next two panels. Agree how you will both know it has worked and when you will review it. Too many actions at once dilute focus.

## Adapt to experience

A new recruiter may need more direct guidance and modelling, such as watching you facilitate a debrief. An experienced recruiter may benefit more from open questions and stretch work. Ask each person how they prefer to receive feedback, and adjust your approach.

## Follow through

Coaching only works if it continues. Schedule regular one-to-ones, return to agreed actions and notice progress. Keep brief notes of what you agreed so that conversations build on each other.

## Practical exercise

Choose one recruiter you support. Review three examples of their recent work and identify one strength and one development area, each with specific evidence. Plan a coaching conversation with at least three open questions and one agreed action.`,
      },
      {
        title: 'Running weekly pipeline reviews',
        markdown: `## Purpose of the review

A weekly pipeline review keeps hiring accountable. It brings the team together to see where every priority role stands, spot risks early and agree actions. Done well, it is short, focused and useful. Done badly, it becomes a status meeting that everyone dreads.

## Prepare before the meeting

Ask recruiters to update their pipelines in the shared system before the review, so the meeting is spent on decisions rather than data entry. A simple view per role is enough:

- Priority level and need date.
- Number of candidates at each stage.
- Days since the last movement.
- Candidates waiting for feedback or an update.
- Main risk and next action.

## A simple agenda

Keep the review to a fixed length and follow the same order each week:

1. **Priority roles first** – review top-priority roles in detail, regardless of how well they are going.
2. **Stuck roles** – roles where nothing has moved for an agreed period.
3. **Waiting candidates** – anyone who has not heard from you within your standard.
4. **Decisions and escalations** – issues that need a hiring manager or leader to act.
5. **Actions** – confirm owners and dates.

Lower-priority roles that are moving well can be skipped or covered briefly.

## Ask useful questions

The leader’s role is to help the team think, not to interrogate. Useful questions include:

- What is blocking this role, and who can unblock it?
- Is the brief still right, or has the market told us something?
- Which candidates are at risk of dropping out, and why?
- What do you need from me?

Avoid public blame. Raise individual performance concerns privately, using the coaching approach.

## Keep it sustainable

Pipeline reviews should also show workload. If one recruiter carries too many difficult roles, rebalance before quality drops. Watch for signs of overload, such as slipping response times or rushed shortlists, and treat them as signals about capacity. Sustainable hiring depends on recruiters having the time to do the work well.

## Track actions

Record agreed actions with owners and dates, and start the next review by checking them. This simple habit turns discussion into accountability. Over time, look at patterns across weeks: recurring blockers often point to process changes worth making.

## Practical exercise

Design a weekly pipeline review for your team: the data each recruiter prepares, a fixed agenda, the time limit and how actions are recorded. Run it for three weeks, then ask the team what to keep, change or drop.`,
      },
    ],
    quiz: [
      {
        text: 'Which of these is the best-written quality standard for a recruiting team?',
        options: [
          'Communicate promptly with all candidates',
          'Be responsive and professional at all times',
          'Every interviewed candidate gets an outcome within agreed working days',
          'Keep candidates happy throughout the process',
        ],
        correct: 2,
      },
      {
        text: 'A quality standard is regularly missed across the whole team. What should the leader do first?',
        options: [
          'Treat it as a signal about capacity or process',
          'Issue a formal warning to each recruiter',
          'Drop the standard without discussing it',
          'Stop measuring it so the gap is hidden',
        ],
        correct: 0,
      },
      {
        text: 'Which is the most useful piece of coaching feedback?',
        options: [
          'You need to be more proactive in debriefs',
          'In Tuesday’s debrief you moved on without asking for evidence',
          'Your debriefs are generally fine but could be better',
        ],
        correct: 1,
      },
      {
        text: 'How many actions should a coaching conversation usually end with?',
        options: [
          'None, because coaching is only discussion',
          'As many as the leader can identify',
          'One for every part of the recruiter’s role',
          'One or two clear actions',
        ],
        correct: 3,
      },
      {
        text: 'In a weekly pipeline review, which roles does the course suggest covering first?',
        options: [
          'Roles with the most applicants',
          'Roles opened most recently',
          'Top-priority roles, regardless of progress',
          'Roles owned by the newest recruiter',
        ],
        correct: 2,
      },
    ],
  },
}
