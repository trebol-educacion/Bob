import {
  TOEFL_BUILD_ITEMS,
  ToeflBuildSentencePlanSchema,
  type ToeflBuildSentencePlan,
} from '../../../src/lib/bank-plans/toefl-build-sentence';
import {
  ToeflAcademicPlanSchema,
  ToeflEmailPlanSchema,
  type ToeflAcademicPlan,
  type ToeflEmailPlan,
} from '../../../src/lib/bank-plans/toefl-writing';
import { stripAllDashes } from '../clean';
import { duplicateIssues, wordRangeIssues } from '../rules';
import { definePart, type PlanPart } from '../types';

function words(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').split(/\s+/).filter((word) => word.length > 0);
}

function sameWords(left: string[], right: string[]): boolean {
  return left.length === right.length && [...left].sort().join(' ') === [...right].sort().join(' ');
}

function buildRules(plan: ToeflBuildSentencePlan): string[] {
  const issues = plan.items.flatMap((item, index) => {
    const label = `item ${index + 1}`;
    const found: string[] = [];
    if (!sameWords(item.tokens.flatMap(words), words(item.correct_sentence))) {
      found.push(`${label}: tokens must be exactly the words of correct_sentence, no more and no fewer`);
    }
    if (words(item.tokens.join(' ')).join(' ') === words(item.correct_sentence).join(' ')) {
      found.push(`${label}: tokens must be shuffled, not in sentence order`);
    }
    if (!/[.?!]$/.test(item.correct_sentence.trim())) found.push(`${label}: correct_sentence must end with punctuation`);
    return found;
  });
  const structures = new Set(plan.items.map((item) => item.structure));
  if (structures.size < 4) issues.push('cover at least four different grammar structures');
  return [...issues, ...duplicateIssues(plan.items.map((item) => item.correct_sentence), 'sentence')];
}

const buildSentence = definePart<ToeflBuildSentencePlan>({
  exam: 'toefl',
  cefr: 'b1',
  skill: 'writing',
  examPart: 'toefl_writing_build_sentence',
  promptKey: 'toefl_writing_build_sentence_b1_generation',
  short: 'tbs-b1',
  schema: ToeflBuildSentencePlanSchema,
  message: (prompt, ctx) =>
    `${prompt}\n\nThis is set number ${ctx.slot}. Return exactly ${TOEFL_BUILD_ITEMS} items with new sentences on different everyday and academic situations.${ctx.existing.length > 0 ? ` Avoid these sentences already used: ${ctx.existing.join(' | ')}.` : ''} Return the JSON only.`,
  normalize: stripAllDashes,
  rules: buildRules,
  labelOf: (plan) => plan.items[0]?.correct_sentence ?? '',
});

const EMAIL_TOPICS = [
  'asking a professor for an extension on an assignment',
  'requesting a recommendation letter',
  'asking the registrar about a missing grade',
  'reporting a problem with a course website',
  'asking about a campus job or internship',
  'requesting a meeting about a research topic',
  'asking the housing office to change a room',
  'explaining an absence and asking for the missed notes',
];

const FORUM_TOPICS = [
  'online classes versus classes on campus',
  'whether universities should require a foreign language',
  'the role of group projects in learning',
  'social media and academic focus',
  'internships versus extra courses',
  'public libraries in the digital age',
  'sustainability on university campuses',
  'standardized tests and admissions',
];

function generateMessage(kind: string) {
  return (prompt: string, ctx: { topic: string; existing: string[] }) =>
    `${prompt}\n\nINPUT: {"mode":"generate"}\n\nGENERATION MODE only. ${kind} about: ${ctx.topic}.${ctx.existing.length > 0 ? ` Do not reuse these: ${ctx.existing.join(' | ')}.` : ''} Return the generation JSON only.`;
}

function emailRules(plan: ToeflEmailPlan): string[] {
  return [
    ...wordRangeIssues(plan.scenario, 20, 90, 'scenario'),
    ...(plan.recipient.trim().length >= 3 ? [] : ['recipient is missing']),
    ...(plan.purpose.trim().length >= 5 ? [] : ['purpose is missing']),
  ];
}

function academicRules(plan: ToeflAcademicPlan): string[] {
  return [
    ...wordRangeIssues(plan.professor_post.text, 25, 90, 'professor post'),
    ...plan.peer_posts.flatMap((post, index) => wordRangeIssues(post.text, 35, 110, `peer post ${index + 1}`)),
    ...(/\?/.test(plan.professor_post.text) ? [] : ['the professor post must contain a question']),
    ...duplicateIssues(plan.peer_posts.map((post) => post.name), 'peer name'),
    ...(/100|minimum/i.test(plan.writing_prompt) ? [] : ['writing_prompt must state the minimum word count']),
  ];
}

const email = definePart<ToeflEmailPlan>({
  exam: 'toefl',
  cefr: 'b1',
  skill: 'writing',
  examPart: 'toefl_writing_email',
  promptKey: 'toefl_writing_email_b1_generation',
  short: 'twe-b1',
  schema: ToeflEmailPlanSchema,
  topics: EMAIL_TOPICS,
  message: generateMessage('Write ONE email scenario'),
  normalize: stripAllDashes,
  rules: emailRules,
  labelOf: (plan) => plan.purpose,
});

const academic = definePart<ToeflAcademicPlan>({
  exam: 'toefl',
  cefr: 'b1',
  skill: 'writing',
  examPart: 'toefl_writing_academic_discussion',
  promptKey: 'toefl_writing_academic_discussion_b1_generation',
  short: 'twa-b1',
  schema: ToeflAcademicPlanSchema,
  topics: FORUM_TOPICS,
  message: generateMessage('Write ONE discussion thread'),
  normalize: stripAllDashes,
  rules: academicRules,
  labelOf: (plan) => plan.professor_post.text.slice(0, 80),
});

export const TOEFL_WRITING_PARTS: PlanPart[] = [buildSentence, email, academic];
