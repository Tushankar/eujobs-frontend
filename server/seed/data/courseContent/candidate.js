/*
 * Seed lesson texts and quizzes of the six candidate courses (M-209, U42): three English Markdown lessons of
 * 300–600 words and five single-choice questions each, written once and committed with the seed.
 */
export const CANDIDATE_COURSE_CONTENT = {
  'interaction-design-foundations': {
    lessons: [
      {
        title: 'Mapping a user flow',
        markdown: `## Start with one goal

A user flow describes the steps a person takes to reach one goal in your product. Before you draw anything, write the goal as a single sentence from the person’s point of view, such as "I want to save a job so I can apply later". A clear goal stops the flow from growing into a map of the whole product.

## Name the entry points

People rarely start where we expect. List every place someone might begin this flow: a search result, a shared address, a notification or a bookmark. Each entry point brings different context. Someone arriving from a notification may already know what they want, while someone arriving from search may still be comparing options.

## Map steps and decisions

Write each step as a screen or a moment, and each decision as a question the person answers. Keep the labels short and use verbs. A simple flow often follows this pattern:

1. The person arrives with a goal.
2. They find the relevant item or action.
3. They provide any information the product needs.
4. They confirm what will happen.
5. They see a clear result and know what to do next.

Where the person has to make a choice, draw a branch. Where the system makes a choice, such as checking whether someone is signed in, draw that branch too. Hidden system decisions are where many flows break.

## Look for the unhappy paths

The happy path is only one route. For each step, ask what could go wrong or be different:

- The person is not signed in.
- The item they wanted no longer exists.
- The connection drops halfway through.
- They change their mind and want to go back.
- They return later on a different device.

You do not need to solve every case at once, but you should know they exist. Mark each one on the map so it becomes a decision you make deliberately rather than a gap someone finds after release.

## Check the flow with evidence

A map is a hypothesis. Walk through it with someone who has not seen it, ideally a person who does the task for real. Ask them to talk you through what they expect at each step. Where their expectations differ from your map, note the difference rather than defending the design.

## Exercise

Choose one goal in a product you use often. Write the goal sentence, list at least three entry points, and map the steps from start to finish. Add at least four unhappy paths and mark which ones the current product handles well and which ones it ignores.`,
      },
      {
        title: 'Designing useful states',
        markdown: `## Every screen has more than one state

A screen designed only with perfect data is half finished. Real interfaces move between states as data loads, fails, grows and disappears. Designing those states up front is one of the most practical ways to make a product feel reliable.

## The core states

For any view that shows data, consider at least these:

- Empty: there is nothing to show yet, either because the person is new or because they have cleared everything.
- Loading: the product is fetching or saving something.
- Partial: some data is available, but not all of it.
- Error: something has gone wrong and the person needs to know what to do.
- Ideal: the view has the amount of content it was designed for.
- Overloaded: there is far more content than expected, such as very long names or hundreds of items.

## Empty states that help

An empty state is often the first thing a new person sees. A blank area with the words "Nothing here" wastes that moment. A useful empty state explains what will appear in this space, why it is empty now, and offers one clear action to change that. If the view is empty because a filter excludes everything, say so and offer to clear the filter. These are different situations and deserve different messages.

## Loading without anxiety

Short waits need little more than a subtle indicator. Longer waits benefit from showing the layout of the content that is coming, so the page does not jump when it arrives. If an action takes a long time, tell people what is happening and whether they can safely leave the page.

## Errors that lead somewhere

A helpful error message answers three questions: what happened, why it matters, and what the person can do now. Avoid blaming language and technical codes on their own. Keep the person’s work wherever possible, so a failed save does not erase a long form. Place the message near the problem, and if a form has several errors, also give a summary at the top that lets people jump to each field.

## Testing your states

Ask a developer what the data really looks like, or use realistic examples. Try the longest realistic name, an account with no history, and a slow connection. Each of these will reveal states you did not draw.

## Exercise

Take one data-heavy screen from the flow you mapped in the previous lesson. Sketch its empty, loading, error and overloaded states. For each one, write the exact message and the single action you offer. Then review them with one question: would a person know what to do next?`,
      },
      {
        title: 'Making interactions accessible',
        markdown: `## Accessibility is part of interaction design

An interaction is not finished until people can complete it in different ways: with a mouse, a keyboard, touch, a screen reader, voice control or magnification. Designing for these from the start is cheaper and more effective than retrofitting them later.

## Keyboard interaction

Many people navigate entirely with a keyboard. For each step of your flow, check that:

1. Every interactive element can be reached with the Tab key, in a logical order that follows the visual layout.
2. Focus is always visible, with a clear outline that has enough contrast against the background.
3. Enter and Space activate buttons and controls as expected.
4. Escape closes dialogs and menus, and focus returns to the element that opened them.
5. Nothing traps focus unless it is a dialog that is meant to hold it until closed.

## Names, roles and states

Assistive technologies read out what an element is, what it is called and what state it is in. A button that shows only an icon still needs a text name. A toggle needs to announce whether it is on or off. When you specify a component, write down its accessible name and the states it can be in, so they are not left to guesswork during build.

## Do not rely on colour alone

If an error is shown only by turning a border red, some people will miss it. Pair colour with text, an icon or a change in shape. Check that text and essential graphics have enough contrast to be read comfortably.

## Timing and movement

Avoid interactions that disappear before people can read them, such as messages with important information that vanish after a few seconds. Give people control over anything that moves, and respect settings that ask for reduced motion.

## Target size and spacing

Small targets placed close together cause mistaken taps, especially for people with limited dexterity or using a phone on the move. Give controls generous hit areas and leave enough space between destructive and harmless actions.

## Evaluate responsibly

Automated checkers catch some issues, but they miss many interaction problems. Test your prototype with a keyboard alone, then with a screen reader, and note where you got lost. Where possible, include disabled people in research and pay them for their time. Be honest about what you tested and what you did not.

## Exercise

Take your flow from the first lesson and complete it using only a keyboard. Write down every point where focus disappeared, the order felt wrong, or a control could not be used. Propose a fix for each one and add the list to your prototype notes.`,
      },
    ],
    quiz: [
      { text: 'When mapping a user flow, what should you write before drawing any steps?', options: ['A full list of every screen in the product', 'The visual style planned for each screen', 'A single sentence describing the person’s goal', 'The final wording for every button'], correct: 2 },
      { text: 'Which of these is a hidden system decision that should be drawn as a branch in a flow?', options: ['Choosing a colour for the main button', 'Checking whether the person is signed in', 'Picking a typeface for the headings', 'Deciding the spacing between cards'], correct: 1 },
      { text: 'A list is empty because the person’s filter excludes every item. What does the lesson recommend?', options: ['Show the same message as for a brand-new account', 'Hide the list area until items appear', 'Explain that the filter is the cause and offer to clear it', 'Show a loading indicator until results arrive'], correct: 2 },
      { text: 'Which three questions should a helpful error message answer?', options: ['Who caused it, when it happened and its error code', 'Which team owns it, how often it occurs and the fix date', 'How rare it is, who reported it and when it will be fixed', 'What happened, why it matters and what the person can do now'], correct: 3 },
      { text: 'After a dialog is closed with the Escape key, where should keyboard focus go?', options: ['To the element that opened the dialog', 'To the very top of the page', 'To the first link in the page footer', 'Nowhere until the person presses Tab'], correct: 0 },
    ],
  },
  'interaction-systems-in-practice': {
    lessons: [
      {
        title: 'Mapping recurring interaction patterns',
        markdown: `## From screens to patterns

In a large product, the same interaction problems appear again and again: picking an item from a long list, confirming a destructive action, editing a value in place, filtering results. When each team solves them separately, people have to relearn the product in every area. An interaction system gives these recurring problems shared, well-understood answers.

## Run a pattern inventory

Start by collecting what already exists. Walk through the product’s main flows and capture every instance of an interaction you see more than once. For each instance, note:

- where it appears and which flow it belongs to;
- what triggers it and what it does;
- how it behaves with a keyboard and with touch;
- how it handles empty, loading and error states.

Group the instances by the job they do, not by how they look. Two components that look different but both ask people to confirm a deletion belong in the same group. Two that look identical but do different jobs should be separated.

## Spot harmful inconsistency

Not all variation is a problem. Some differences exist for good reasons, such as a denser layout for expert users. The variations worth fixing are the ones that cause mistakes: an undo option available in one place but not another, a dialog that saves on close in one area and discards changes in another, or a keyboard shortcut that means different things in different views. Mark these clearly, because they are the strongest argument for a shared pattern.

## Define the pattern, not just the component

A component is a piece of interface. A pattern also describes when to use it, when not to, and how it behaves. For each recurring problem, write:

1. The problem it solves, in one sentence.
2. The recommended solution and its variants.
3. When to choose a different pattern instead.
4. The states and behaviours it must support.
5. Known edge cases.

## Decide what to standardise first

You cannot fix everything at once. Prioritise patterns that appear often, cause errors or block accessibility. A small number of well-defined patterns that teams trust is worth more than a large library nobody follows.

## Keep it alive

Patterns change as the product grows. Agree who reviews proposed changes and how teams can suggest new patterns. Without that, the inventory quickly becomes a historical document rather than a working tool.

## Exercise

Pick one recurring interaction in a complex product, such as filtering or confirming a deletion. Find at least four instances, record how each one behaves, and highlight the differences that could cause mistakes. Write a one-page pattern definition using the five headings above.`,
      },
      {
        title: 'Writing behavior specifications',
        markdown: `## Why behaviour needs writing down

A static mock-up shows how something looks at one moment. It does not say what happens when someone double-clicks, loses their connection or presses Escape halfway through. Those decisions still get made, often during build and often inconsistently. A behaviour specification makes them deliberate and shared.

## Describe triggers and outcomes

The clearest specifications describe behaviour as a set of rules. Each rule names a starting condition, a trigger and the expected outcome. For example: when a filter panel is open and the person presses Escape, the panel closes without applying unsaved changes and focus returns to the filter button. This structure is easy for designers, developers and testers to read and check.

## What a good specification covers

For each pattern or component, include:

- Default behaviour: what happens in the normal case.
- States: every state the element can be in and how it moves between them.
- Input methods: mouse, touch, keyboard and assistive technology.
- Content limits: minimum and maximum lengths, and what happens beyond them.
- Timing: delays, timeouts and what happens if something is slow.
- Errors: what can fail and how the person recovers.
- Out of scope: what the pattern deliberately does not handle.

## Use a state diagram when it helps

Some elements have many states, such as an upload that can be waiting, in progress, paused, failed or complete. Drawing these as boxes joined by arrows labelled with their triggers exposes missing transitions. If you cannot say what happens when a paused upload loses its connection, you have found a gap before anyone writes code.

## Write plainly

Specifications are read by people with different backgrounds. Use short sentences, consistent terms and the present tense. Pick one name for each thing and use it everywhere. Avoid phrases such as "should probably" or "ideally", which leave room for different interpretations. If a decision is still open, say so and name who will make it.

## Review with the people who build and test

Walk through the specification with a developer and someone who tests the product. Ask them to find cases the rules do not cover. Their questions are evidence of where the specification is unclear, and answering them before build is cheaper than fixing behaviour afterwards.

## Exercise

Choose the pattern you defined in the previous lesson. Write at least eight behaviour rules using the condition, trigger and outcome structure. Include at least two keyboard rules and two error rules. Then list three open questions you would take to a developer.`,
      },
      {
        title: 'Testing edge cases',
        markdown: `## What counts as an edge case

An edge case is a situation outside the conditions a design was mainly built for. Individually they may be uncommon, but across a large product used by many people, they happen every day. Patterns that fail at the edges erode trust in the whole system, because people can no longer predict how the product will behave.

## Common categories

Use these categories as a checklist when reviewing any pattern:

- Content: very long or very short text, missing images, unusual characters, right-to-left languages.
- Quantity: zero items, one item, and far more items than expected.
- Time: slow connections, actions that take minutes, sessions that expire mid-task.
- Permissions: people who can view but not edit, or whose access changes while they work.
- Concurrency: two people editing the same thing, or the same person working in two tabs.
- Input: keyboard only, screen reader, zoomed to a large size, touch on a small screen.
- Interruption: closing the browser, going back or refreshing halfway through.

## Build a test matrix

List the patterns down one side and the categories across the top. In each cell, write what should happen according to the specification, then test what actually happens. Gaps in the specification show up as empty cells. Differences between the specification and the product show up as failed tests. Both are useful findings.

## Use realistic data

Placeholder text hides problems. Ask for anonymised examples of real content, or create test data based on what people actually enter. A name field tested only with short invented names will not reveal how the layout copes with a long, hyphenated surname.

## Prioritise what you find

You will find more issues than you can fix. Rank them by how many people they could affect, how severe the consequence is, and whether there is a workaround. An edge case that loses someone’s work is more serious than one that makes text wrap awkwardly, even if the second appears more often.

## Report findings responsibly

Describe each issue with the steps to reproduce it, what you expected and what happened. Avoid exaggerating rare problems, and avoid dismissing them simply because they are rare. Note what you did not test, so readers understand the limits of your review.

## Exercise

Build a small test matrix for the pattern you specified in the previous lesson. Test at least five categories, record the results, and rank the three most serious issues. Suggest a specification change for each one.`,
      },
    ],
    quiz: [
      { text: 'When running a pattern inventory, how should you group the instances you collect?', options: ['By the visual style of each component', 'By the job each interaction does', 'By the team that built each one', 'By the date each one was released'], correct: 1 },
      { text: 'Which kind of inconsistency is most worth fixing with a shared pattern?', options: ['Denser layouts made deliberately for expert users', 'Different illustrations used in different sections', 'Page titles worded slightly differently by area', 'Undo available in one area but missing in another'], correct: 3 },
      { text: 'In a behaviour specification, what three parts does each rule name?', options: ['An owner, a deadline and a priority level', 'A colour, a size and a screen position', 'A starting condition, a trigger and an expected outcome', 'A user type, a device and a release date'], correct: 2 },
      { text: 'Why does the lesson suggest drawing a state diagram for elements with many states?', options: ['It exposes missing transitions between states', 'It replaces the need for a written specification', 'It makes the design look more polished in reviews', 'It removes the need to review with developers'], correct: 0 },
      { text: 'Which edge case does the lesson treat as more serious?', options: ['One that makes text wrap awkwardly but appears often', 'One that loses someone’s work, even if it is rarer', 'One that only appears on very large screens'], correct: 1 },
    ],
  },
  'designing-trusted-fintech-journeys': {
    lessons: [
      {
        title: 'What makes a financial journey feel safe',
        markdown: `## Trust is built in small moments

People bring caution to anything involving their money. A financial journey feels safe when each step behaves as expected, explains what is happening and never surprises people with costs or consequences. Trust is rarely won by one big promise. It is earned, or lost, in small moments across the whole journey.

## Signals that build trust

Look for these qualities when you review a financial journey:

- Predictability: buttons do what their labels say, and the same action works the same way everywhere.
- Transparency: fees, exchange rates, timings and limits are shown before the person commits, not after.
- Control: people can review, change or cancel before anything irreversible happens.
- Feedback: every action has a clear result, including a record people can find later.
- Recoverability: mistakes can be corrected, or there is a clear route to help.

## Moments that erode trust

Trust erodes quickly when a journey hides information or rushes decisions. Common examples include a total that changes on the final screen, a pre-ticked box that adds an extra product, a countdown timer that pressures people to act, and vague messages such as "Something went wrong" after money has left an account. Each of these leaves people unsure whether they are in control.

## Security without fear

Security steps, such as verifying identity or confirming a new device, can reassure people when they are explained. They frustrate people when they appear without warning or block progress without saying why. Tell people why a check is needed, how long it will take and what happens next. Avoid alarming language unless there is a genuine risk that needs action.

## Status and uncertainty

Payments and transfers often take time. If money is pending, say so plainly and give an honest expected time, or say that you do not know yet. Showing a payment as complete when it is not, or showing nothing at all, leads to repeated attempts and anxious calls for support.

## Review the journey end to end

Trust problems often sit between screens: a promise on a landing page that the sign-up flow does not keep, or an email that uses different terms from the app. Walk the whole journey, including messages, statements and support routes, not just the main screens.

## Exercise

Choose one financial journey, such as sending money or opening a savings account. Walk through it from start to finish and list every moment that builds trust and every moment that erodes it. For the three weakest moments, write a clearer alternative and note what evidence would show whether it works.`,
      },
      {
        title: 'Explaining risk in plain language',
        markdown: `## Why plain language matters

Financial products carry real risks: losing money, paying more than expected or being locked into an agreement. People can only make a fair choice if they understand those risks. Dense legal text may be accurate, but if people cannot understand it, they are not truly informed. Explaining risk clearly is part of treating people fairly, and in many places it is also expected by regulators.

## Principles for explaining risk

1. Lead with what matters most to the person, such as what they could lose or what it will cost.
2. Use everyday words. Replace terms such as "principal" or "variable rate" with plain explanations, or define them where they appear.
3. Use concrete examples. A worked example with realistic numbers is easier to understand than a percentage on its own.
4. Show both sides. Present potential downsides with the same prominence as potential benefits.
5. Keep sentences short, with one idea per sentence.

## Placement and timing

Risk information is most useful at the moment of decision. A warning buried in terms and conditions does little, while a short, clear statement next to the action button helps people pause and consider. Repeat key risks at confirmation rather than assuming people remember them from earlier screens.

## Avoid false reassurance and false alarm

Two mistakes are common. The first is softening risk with friendly language until it no longer sounds like a risk. The second is filling screens with so many warnings that people stop reading them. Prioritise the risks that most affect the decision, and keep secondary information available but out of the way.

## Work with specialists

Designers rarely own the final wording of risk statements alone. Work with legal, compliance and product specialists early. Bring them drafts and evidence from testing rather than finished screens, and agree which parts of the wording are fixed and which can be simplified.

## Test understanding, not preference

Asking people whether they like a message tells you little. Instead, ask them to explain in their own words what could happen if they go ahead. If several people get it wrong, the message needs work, however polished it looks. Record what people said, not your interpretation of it.

## Exercise

Find a risk statement in a financial product, such as a warning about investment value or a late payment fee. Rewrite it using the five principles above. Then ask two people to explain both versions back to you in their own words, and note which one they understood more accurately.`,
      },
      {
        title: 'Designing consent and confirmation',
        markdown: `## Consent is a decision, not a formality

In financial products, people are often asked to agree to things: sharing data, accepting terms, setting up recurring payments or authorising a transfer. Real consent means the person understands what they are agreeing to, has a genuine choice and can change their mind where possible. A box ticked without understanding is not meaningful consent.

## Principles for meaningful consent

- Be specific: ask for one thing at a time rather than bundling several permissions into a single agreement.
- Start unticked: never pre-select options that share data or add products.
- Explain consequences: say what happens if people agree and what happens if they do not.
- Make refusal real: declining should not be hidden, shamed or made harder than accepting.
- Make it reversible: show where people can review and withdraw consent later.

## Designing confirmation screens

A confirmation step gives people one last chance to check before an action becomes difficult to undo. A useful confirmation screen summarises exactly what will happen:

1. The amount, any fees and the total.
2. Who or what will receive the money or data.
3. When it will happen and how long it will take.
4. Whether it can be cancelled, and until when.

Use a button label that names the action, such as "Send payment", rather than a generic "OK". Place a clear way to go back and edit next to it.

## Match friction to risk

Not every action needs a confirmation step. Adding them everywhere trains people to click through without reading. Reserve stronger confirmation for actions that are high in value, irreversible or unusual for that person, such as paying a new recipient. Lower-risk actions can rely on clear feedback and an undo option instead.

## After confirmation

The journey does not end at the button. Show a clear result, give a reference people can keep and explain what happens next. If something fails after confirmation, tell people promptly and say whether their money has moved.

## Evaluate carefully

Check that people can tell what they agreed to after the fact. A simple test is to ask participants, a few minutes after completing a flow, what they consented to and how they would undo it. Gaps in their answers show where consent was not meaningful.

## Exercise

Take the journey you reviewed in the first lesson and redesign its consent and confirmation steps. Write the exact wording for one consent request and one confirmation screen, then list which actions deserve strong confirmation and which can rely on an undo option.`,
      },
    ],
    quiz: [
      { text: 'Which practice helps to build trust in a financial journey?', options: ['Revealing the final total only on the last screen', 'Using a countdown timer to encourage quick decisions', 'Showing fees and timings before the person commits', 'Pre-ticking a box that adds an extra product'], correct: 2 },
      { text: 'A payment is still pending and the exact timing is unknown. What does the lesson recommend?', options: ['Show the payment as complete to reassure people', 'Say plainly that it is pending and be honest about timing', 'Hide the payment until it has fully cleared', 'Ask the person to try sending the payment again'], correct: 1 },
      { text: 'How does the lesson suggest testing whether a risk statement works?', options: ['Ask people to explain in their own words what could happen', 'Ask people which of two versions they prefer visually', 'Measure how quickly people scroll past the statement'], correct: 0 },
      { text: 'Which approach follows the principles of meaningful consent?', options: ['Bundling all permissions into one agreement', 'Asking for one thing at a time with options unticked', 'Making the decline option smaller and harder to find', 'Leaving out where consent can be withdrawn later'], correct: 1 },
      { text: 'Why should strong confirmation steps not be added to every action?', options: ['They make the product look less modern', 'They are not allowed in most financial products', 'They always delay payments by several days', 'They train people to click through without reading'], correct: 3 },
    ],
  },
  'design-leadership-in-practice': {
    lessons: [
      {
        title: 'Framing a decision',
        markdown: `## Why framing comes first

Many design discussions go in circles because people are answering different questions. One person is debating the visual style, another is worried about deadlines, and a third is questioning whether the feature is needed at all. Framing the decision before discussing solutions gives everyone the same question to answer. You do not need a senior title to do this; you need clarity.

## Write the decision as a question

State the decision in one sentence that ends with a question mark, such as "Should the onboarding flow ask for preferences before or after showing the first results?" A good decision question is specific, has more than one reasonable answer and is something the group can actually decide.

## Set out the context

Before listing options, give the group what they need to judge them:

- The problem: what is happening now and who it affects.
- The goal: what a good outcome would look like.
- Constraints: time, technical limits, policy or budget.
- What is already decided: so nobody reopens settled questions by accident.
- Who decides: the person or group accountable for the final call.

## Present real options

Offer two to four genuine options, including doing nothing if that is realistic. For each one, describe:

1. What it is, in a sentence or a simple sketch.
2. What it would probably improve.
3. What it would cost or risk.
4. What we know and what we are assuming.

Avoid presenting one strong option alongside weak ones you have made up to lose. People notice, and it damages trust in your framing.

## Name the criteria

Agree how the options will be judged before comparing them. Criteria might include the effect on people using the product, effort, reversibility and risk. When criteria are agreed first, the discussion focuses on evidence rather than on who argues most confidently.

## Separate deciding from exploring

Be clear whether a meeting is for exploring options or making a decision. If you need a decision, say so in the invitation and share the framing in advance so people arrive prepared.

## Record the outcome

Write down what was decided, why, and what would make you revisit it. A short decision record saves time later when someone asks why the team chose this path.

## Exercise

Pick a real decision your team faces or recently faced. Write a one-page framing document with the decision question, context, three options and agreed criteria. Share it with one colleague and ask whether anything important is missing.`,
      },
      {
        title: 'Running a useful critique',
        markdown: `## What critique is for

A design critique is a structured conversation that helps a piece of work get better. It is not a vote, an approval meeting or a chance to show off. Done well, critique gives the designer specific, actionable feedback tied to goals. Done badly, it turns into a list of personal preferences or a defensive debate.

## Before the session

Good critique starts with preparation. The person sharing work should state:

- the goal of the design and who it is for;
- the stage the work is at, such as early exploration or near final;
- the kind of feedback they want, and what is out of scope;
- any constraints the group should know about.

Share this at the start so reviewers can calibrate their comments. Feedback on spacing is unhelpful when the designer is still deciding whether the flow should exist.

## Agree roles and format

Ask a facilitator to keep time and steer the conversation, and a note-taker to record comments so the presenter can listen. A simple format works well:

1. The presenter explains the context and goals.
2. Reviewers look at the work quietly and write notes.
3. Reviewers share feedback one point at a time.
4. The presenter asks clarifying questions but does not defend.
5. The group agrees the most important points and next steps.

## Make feedback specific, kind and useful

Tie each comment to the goal. Instead of "I don’t like this", say what you observed and why it matters: "The main action sits below the fold on smaller screens, so people may not see how to continue." Ask questions when you are unsure, and separate observations from suggestions. Kind does not mean vague; it means respecting the person while being honest about the work.

## Handle common problems

If one voice dominates, the facilitator invites others in by name. If the conversation drifts into solving the problem in the room, note the idea and return to feedback. If comments become personal, bring the discussion back to the work and its goals.

## Close with actions

End by summarising the main themes and agreeing what the presenter will do next. The presenter decides which feedback to act on; critique informs decisions, it does not make them.

## Exercise

Plan a thirty-minute critique for a piece of work in progress. Write the context statement, choose roles and draft three ground rules for the session. Afterwards, note which comments led to a change and which did not, and why.`,
      },
      {
        title: 'Influencing with evidence',
        markdown: `## Influence without authority

Designers often need people to act on recommendations they do not control: a product manager deciding priorities, an engineer weighing effort, a stakeholder approving scope. Influence based on title alone does not last. Influence based on evidence, shared openly and honestly, builds credibility over time.

## Know what counts as evidence

Evidence comes in different forms, and each has strengths and limits:

- Observations from research sessions show how and why people behave as they do.
- Usage data shows what people do at scale, but rarely why.
- Support requests and feedback reveal pain points, but over-represent people who chose to get in touch.
- Usability test results show whether a design works for a specific task.
- Comparisons with established patterns suggest what people may already expect.

Combining sources is stronger than relying on one. When two kinds of evidence point the same way, your case is more convincing.

## Be honest about confidence

State how strong your evidence is. Five interviews can reveal important problems, but they cannot tell you how common those problems are. Say what you know, what you suspect and what you do not know yet. Overstating findings may win one argument, but it damages trust when the gaps are found.

## Connect evidence to what others care about

Different people weigh different things. An engineer may care about complexity and maintenance, a product manager about goals and timelines, a support lead about the volume of requests. Explain how your recommendation affects their concerns, in their language, without changing what the evidence says.

## Show, do not just tell

A short clip of a participant struggling, a quote in their own words or a side-by-side comparison often communicates more than a long report. Choose examples that are representative, not just the most dramatic, and keep participants anonymous.

## Make the next step small

Large recommendations invite large objections. Where possible, propose a small, reversible step, such as a test or a pilot, that would produce more evidence. This lowers the risk of saying yes and keeps the conversation focused on learning.

## Exercise

Take the decision you framed in the first lesson. Gather at least two kinds of evidence relevant to it and write a one-page recommendation. Include a confidence statement, one representative example and a small next step. Then run the recommendation through a short critique with a colleague, using the format from the second lesson.`,
      },
    ],
    quiz: [
      { text: 'What is the main purpose of framing a decision before discussing solutions?', options: ['To make sure the most senior person speaks first', 'To give everyone the same question to answer', 'To avoid having to write anything down', 'To reduce the number of people involved'], correct: 1 },
      { text: 'Why should you avoid presenting one strong option alongside weak ones made up to lose?', options: ['People notice, and it damages trust in your framing', 'It makes the meeting run longer than planned', 'Decision records can only include one option', 'Weak options are always more costly to build'], correct: 0 },
      { text: 'During a critique, what should the presenter do while reviewers share feedback?', options: ['Defend each design choice as it is raised', 'Leave the room so reviewers can speak freely', 'Ask the group to vote on each comment', 'Ask clarifying questions without defending'], correct: 3 },
      { text: 'Which comment best follows the guidance on specific, kind and useful feedback?', options: ['I do not like the layout, so please change it', 'It looks fine to me overall, so nice work', 'The main action is below the fold, so people may miss it', 'It needs more energy, so try a bolder style'], correct: 2 },
      { text: 'According to the lesson on evidence, what can five interviews tell you?', options: ['How common a problem is across all users', 'Important problems, but not how common they are', 'Exact figures to use for roadmap planning'], correct: 1 },
    ],
  },
  'designing-for-developer-workflows': {
    lessons: [
      {
        title: 'Researching technical workflows',
        markdown: `## Start from curiosity, not expertise

Technical workflows, such as deploying code, investigating an incident or reviewing a change, can feel intimidating to research. You do not need to be an expert to study them well. You need to be curious, honest about what you do not know, and careful not to assume that your mental model matches how people really work.

## Learn the vocabulary first

Before your first session, collect the terms people use and what they mean. Read internal documentation, sit in on team discussions and ask a friendly engineer to walk you through the basics. Keep a glossary. Understanding the words lets you follow what participants say without stopping them constantly, but it does not replace asking what they mean in their own context.

## Observe real work

Interviews alone often miss the detail of technical work, because people forget the small steps they do automatically. Where possible, observe people doing a real task:

1. Ask them to share their screen and talk through what they are doing.
2. Note every tool, window and tab they switch between.
3. Record where they search, copy, paste or retype information.
4. Mark moments of waiting, hesitation or workaround.
5. Ask why after the task, not during it, so you do not interrupt their flow.

Workarounds are especially valuable. A note file full of saved commands, or a personal script that combines several outputs, shows you exactly where the product falls short.

## Respect sensitive environments

Technical work often involves private systems, credentials and customer data. Agree in advance what you may see and record. Ask people to close sensitive windows, avoid capturing secrets and store notes securely. If you cannot observe live work, ask participants to recreate a recent task with safe example data.

## Avoid the expert trap

Experienced engineers may describe an idealised version of their process. Newer team members may hide their struggles. Include people at different levels of experience, and ask about specific recent occasions, such as the last time they investigated a failed deployment, rather than what they usually do.

## Map the workflow

After the sessions, map the workflow as a sequence of steps, noting the tools used, the information needed at each step and the pain points. Look for places where people need information from several sources at once. These are often where overload slows them down.

## Exercise

Choose one technical workflow you can observe, such as reviewing a code change. Run one observation session with permission, build a glossary of at least ten terms and map the workflow. Highlight the two steps where people gather the most information from different places.`,
      },
      {
        title: 'Structuring dense information',
        markdown: `## Density is not the enemy

Technical users often need a lot of information on screen at once: logs, statuses, metrics, timestamps and identifiers. Removing information to make a view look clean can slow them down, because they then have to open more screens to find what they need. The goal is not less information, but information that can be scanned and understood quickly.

## Start with the questions people ask

Use your research to list the questions people bring to the view. For example: is anything broken, what changed recently, and which item needs my attention first? Order and group information around those questions, with the most urgent answer the most visible.

## Techniques for scannable density

- Group related information and separate groups with spacing rather than heavy borders.
- Align numbers to the right and use consistent formats, so values can be compared at a glance.
- Use status labels that combine text with colour or shape, so meaning does not depend on colour alone.
- Shorten long identifiers carefully, keeping the parts people use to tell items apart, and give a way to see or copy the full value.
- Show relative times, such as "five minutes ago", alongside exact timestamps when precision matters.
- Use monospaced type for values that must be compared character by character.

## Progressive disclosure

Not everything needs to be visible at once. Show a summary first and let people expand details when they need them. Be careful, though: hiding information people need constantly forces repeated clicks. Your research should tell you which details are needed often and which only occasionally.

## Sorting, filtering and saved views

Dense views become manageable when people can shape them. Provide sorting on the columns people compare, filters for the attributes they care about, and a way to save a view they return to often. Make active filters obvious, so nobody mistakes a filtered list for the whole picture.

## Highlight what changed

In operational work, change is often what matters most. Make new, updated or failing items stand out, and let people mark items as seen. A view that looks the same whether everything is fine or something is failing is not doing its job.

## Test with real data

A layout that works with ten tidy example rows may fail with hundreds of messy ones. Test with realistic volumes, long values and unusual cases, and ask participants to find specific answers under time pressure.

## Exercise

Take one dense view from the workflow you mapped in the previous lesson. List the three questions people bring to it, then redesign the layout so each question can be answered at a glance. Test it with realistic data and note what you changed and why.`,
      },
      {
        title: 'Designing for keyboard and command use',
        markdown: `## Why keyboard use matters here

Many people in technical roles spend much of their day at a keyboard. Reaching for a mouse to complete repetitive actions breaks their concentration and slows them down. Designing for keyboard and command use respects how these people already work, and it improves access for everyone who cannot use a pointer or prefers not to.

## Full keyboard support comes first

Before adding shortcuts, make sure every action can be completed with a keyboard using standard navigation. Focus should be visible and move in a logical order. Shortcuts are an accelerator on top of a solid foundation, not a replacement for it.

## Designing shortcuts

Good shortcuts are memorable, consistent and safe. When defining them:

1. Prioritise the actions people repeat most often, based on your research.
2. Follow conventions people already know from other tools on their platform, rather than giving familiar keys new meanings.
3. Keep each shortcut meaning the same thing across the whole product.
4. Avoid single-key shortcuts for destructive actions, so a stray keypress cannot delete something important.
5. Make sure shortcuts do not clash with those of the browser, the operating system or assistive technology.

## Make shortcuts discoverable

Shortcuts nobody knows about do not help. Show them in tooltips and menus next to the action they trigger, and offer a reference list people can open at any time. Avoid long tutorials; people learn shortcuts gradually, as they need them.

## Command palettes

A command palette lets people type the name of an action and run it without navigating menus. It works well in products with many actions. Make search forgiving of typos and synonyms, show recently used commands first, and display each command’s shortcut so people can learn it. Keep the palette consistent with the rest of the interface, so the same action has the same name everywhere.

## Feedback and recovery

Keyboard actions can happen quickly, sometimes faster than people can see the result. Give clear feedback when an action runs, and offer undo for anything that changes data. For actions that cannot be undone, ask for a confirmation that also works from the keyboard.

## Evaluate with real users

Watch experienced and newer users complete tasks. Note which shortcuts they use, which ones they try that do not exist, and where they reach for the mouse. Those moments show where your keyboard design still has gaps.

## Exercise

For the view you redesigned in the previous lesson, list the five most frequent actions and propose a shortcut for each. Check them against the five rules above, then sketch how they would appear in a command palette.`,
      },
    ],
    quiz: [
      { text: 'Why does the lesson recommend observing real work rather than relying on interviews alone?', options: ['Interviews are rarely allowed in technical teams', 'People forget the small steps they do automatically', 'Observation is always quicker to analyse', 'Engineers prefer not to answer questions'], correct: 1 },
      { text: 'What should you do if you cannot observe live work because it involves sensitive data?', options: ['Skip the research and rely on your assumptions', 'Record their screens without mentioning it', 'Ask people to recreate a recent task with safe example data', 'Interview only managers about the process'], correct: 2 },
      { text: 'Which technique helps people compare numbers quickly in a dense view?', options: ['Align numbers to the right and use consistent formats', 'Centre every number within its column', 'Show numbers only when people hover over a row', 'Give every value its own distinct colour'], correct: 0 },
      { text: 'Why should single-key shortcuts be avoided for destructive actions?', options: ['They are hard to show in tooltips', 'They cannot be listed in a command palette', 'They always clash with screen readers', 'A stray keypress could delete something important'], correct: 3 },
      { text: 'What does the lesson recommend a command palette displays next to each command?', options: ['The date the command was first added', 'The keyboard shortcut for that command', 'The name of the team that built it'], correct: 1 },
    ],
  },
  'evidence-led-user-interviews': {
    lessons: [
      {
        title: 'Planning an ethical interview',
        markdown: `## Start with what you need to learn

Every interview should serve a clear purpose. Before recruiting anyone, write down what you want to learn and what decision it will inform. For example: "We want to understand how people decide which job adverts to apply for, so we can improve how adverts are presented." A clear purpose keeps the interview focused and stops you collecting information you do not need.

## Choose participants carefully

Think about whose experience matters for your question. Include a range of people, not just those who are easiest to reach. Write simple screening criteria, and avoid recruiting only colleagues, friends or enthusiastic existing customers, as they may not represent the people you are designing for.

## Respect people and their time

Ethical research treats participants as people giving you something valuable. Before the session:

- Tell them the purpose, how long it will take and what you will ask about.
- Explain how their information will be recorded, stored, used and deleted.
- Ask for informed consent, including separate consent for recording.
- Make clear they can skip any question or stop at any time without giving a reason.
- Offer fair compensation for their time where you can.

Keep sessions to the time you promised. Running over signals that their time matters less than your questions.

## Protect personal information

Collect only the personal information you need. Store notes and recordings securely, limit who can access them, and remove names and identifying details from anything you share. Agree how long you will keep the data, and delete it when that time has passed.

## Plan for sensitive topics

Some subjects, such as losing a job, money or health, can be upsetting. If your topic might touch on these, prepare gentle wording, allow pauses, and be ready to move on or end the session. Never push for detail someone seems reluctant to share.

## Write a discussion guide

A discussion guide is a plan, not a script. It usually includes:

1. A short introduction and a consent check.
2. Warm-up questions about the person’s context.
3. Main topics, each with a few open questions.
4. Space for anything the person wants to add.
5. A thank-you and an explanation of what happens next.

## Rehearse

Run a practice session with a colleague. Time it, notice confusing questions and adjust. Rehearsing helps you stay relaxed and attentive in the real session.

## Exercise

Write a one-paragraph research purpose, screening criteria for five participants, a consent statement in plain language and a discussion guide for a thirty-minute interview. Rehearse it once with a colleague and revise anything that felt unclear.`,
      },
      {
        title: 'Asking neutral questions',
        markdown: `## Why neutrality matters

The way you ask a question shapes the answer you get. People are often polite and want to be helpful, so they may tell you what they think you want to hear. Neutral questions reduce that pressure and give you a more honest picture of their experience.

## Ask about past behaviour

People are better at describing what they did than predicting what they will do. Instead of asking "Would you use a feature that saves searches?", ask "Tell me about the last time you searched for a job. What happened?" Real stories include details, workarounds and frustrations that hypothetical answers miss.

## Avoid common traps

Watch for these patterns in your discussion guide:

- Leading questions suggest an answer, such as "How much easier was the new layout?" Ask "How did you find the new layout?" instead.
- Double questions ask two things at once, such as "Was it quick and clear?" Split them.
- Yes or no questions close down the conversation. Open questions that start with how, what or "tell me about" invite stories.
- Loaded words, such as "frustrating" or "simple", put your judgement into the question.
- Asking directly about your own design makes people reluctant to criticise it.

## Use follow-up prompts

The most useful detail often comes after the first answer. Simple prompts keep people talking without steering them:

1. "Can you tell me more about that?"
2. "What happened next?"
3. "Why was that important to you?"
4. "Can you show me?"

Repeating someone’s last few words back to them can also encourage them to expand.

## Be comfortable with silence

After asking a question, wait. People often need a moment to think, and the pause invites them to add more. Filling silence quickly can lead you to suggest an answer.

## Watch your reactions

Nodding enthusiastically at some answers and staying quiet at others signals what you want to hear. Keep your reactions even and encouraging, whatever people say. Thank people for honest criticism as warmly as for praise.

## Review your questions

Read your discussion guide aloud and mark every question that could lead, assume or combine. Rewrite them before the session. During rehearsal, ask your colleague whether any question made them feel there was a right answer.

## Exercise

Take the discussion guide from the previous lesson. Identify at least three questions that could be leading, double or closed, and rewrite them as neutral, open questions about past behaviour. Rehearse the new versions and note how the answers change.`,
      },
      {
        title: 'Capturing observations',
        markdown: `## Notes are your evidence

Interviews only become useful when you can trace your findings back to what people actually said and did. Good notes are your evidence. Without them, findings drift towards what the team already believed.

## Separate observation from interpretation

While taking notes, keep three things apart:

- What the person said, ideally in their own words.
- What they did, such as hesitating, scrolling back or showing you a workaround.
- What you think it means, clearly marked as your interpretation.

Mixing these makes it hard to judge later whether a finding is well supported. A simple habit is to write interpretations in a separate column or mark them with a symbol.

## Capture verbatim quotes

Short exact quotes are powerful because they show the person’s language and reasoning. Note who said them using a participant code rather than a name, and roughly when in the session. Be careful not to tidy quotes into something more articulate than what was said.

## Work in pairs where possible

Interviewing and taking notes at the same time is hard. If you can, have one person lead the conversation and another take notes. Agree beforehand how the note-taker can ask a question, so the participant is not interrupted by two voices at once.

## Debrief straight away

Spend ten minutes after each session writing down the most important things you noticed while they are fresh. Note surprises, contradictions and anything that changed your thinking. These short debriefs make later analysis faster and more accurate.

## From notes to findings

When all sessions are done, turn observations into findings:

1. Write each observation on its own note, with its participant code.
2. Group notes that point to the same underlying behaviour or need.
3. Name each group with a statement that describes what you saw.
4. Check how many participants contributed to each group, and look for evidence that contradicts it.
5. Write each finding with the quotes and observations that support it.

## Be careful with your claims

A finding should not claim more than the evidence supports. If three of six participants described a problem, say so rather than suggesting everyone has it. Interviews show what happens and why; they do not tell you how common something is across everyone who uses a product. Note what you did not learn and what would need further research.

## Exercise

Using notes from a rehearsal or a real interview, separate observations from interpretations. Then write three findings, each citing at least two pieces of evidence from your notes, and add one sentence on the limits of each finding.`,
      },
    ],
    quiz: [
      { text: 'What should you write down before recruiting any participants?', options: ['The visual design you hope to validate', 'What you want to learn and what decision it will inform', 'The answers you expect each participant to give', 'A list of colleagues who could take part'], correct: 1 },
      { text: 'Which of these interview questions is the most neutral?', options: ['How much easier was the new layout?', 'Was the new layout quick and clear?', 'How did you find the new layout?', 'Did you like the simpler new layout?'], correct: 2 },
      { text: 'Why does the lesson recommend asking about past behaviour?', options: ['People describe what they did better than what they will do', 'Past events always matter more than future plans', 'Questions about the past make every interview shorter'], correct: 0 },
      { text: 'While taking notes, what should be kept separate from what people said and did?', options: ['The participant’s job title', 'Your own interpretation of what it means', 'The time the session started', 'The name of the note-taker'], correct: 1 },
      { text: 'Three of six participants described a problem. How should the finding report this?', options: ['As a problem that everyone experiences', 'As a problem too rare to be worth reporting', 'As a problem affecting half of all product users', 'As three of six participants, without claiming more'], correct: 3 },
    ],
  },
}
