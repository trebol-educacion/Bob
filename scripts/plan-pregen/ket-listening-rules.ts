import type { KetListenChooseGen } from '../../src/lib/bank-plans/ket-listening-part1';
import type { KetListenCompleteGen } from '../../src/lib/bank-plans/ket-listening-part2';
import type { KetListenDecideGen } from '../../src/lib/bank-plans/ket-listening-part3';
import type { KetShortConversationsGen } from '../../src/lib/bank-plans/ket-listening-part4';
import type { KetListenMatchGen } from '../../src/lib/bank-plans/ket-listening-part5';
import type { JudgeRequest } from './types';
import { duplicateIssues, keyDistributionIssues, optionIssues, wordRangeIssues, wordsIn } from './rules';
import { labelledTranscript } from './ket-listening-media';

const numberIssues = (numbers: number[], label: string): string[] =>
  numbers.flatMap((n, i) => (n === i + 1 ? [] : [`${label} ${i + 1}: number must be ${i + 1}`]));

export function chooseRules(plan: KetListenChooseGen): string[] {
  return [
    ...numberIssues(plan.items.map((i) => i.number), 'item'),
    ...keyDistributionIssues(plan.items.map((i) => i.correct_option), 3, 'items'),
    ...duplicateIssues(plan.items.map((i) => i.context), 'context'),
    ...plan.items.flatMap((item) => [
      ...wordRangeIssues(item.dialogue.map((t) => t.line).join(' '), 22, 70, `item ${item.number} dialogue`),
      ...optionIssues(item.options.map((o) => o.description), `item ${item.number}`),
      ...duplicateIssues(item.options.map((o) => o.image_prompt), `item ${item.number} image_prompt`),
    ]),
  ];
}

export function chooseJudge(plan: KetListenChooseGen): JudgeRequest {
  return {
    kind: 'comprehension',
    input: {
      text: null,
      items: plan.items.map((item) => ({
        number: item.number,
        question: item.question,
        options: item.options.map((o) => ({ key: o.id, label: o.description })),
        claimed_key: item.correct_option,
        explanation: 'The picture that matches what the speakers say.',
        source: labelledTranscript(item.dialogue),
      })),
    },
  };
}

export function completeRules(plan: KetListenCompleteGen): string[] {
  const spoken = plan.transcript.toLowerCase();
  return [
    ...numberIssues(plan.gaps.map((g) => g.number), 'gap'),
    ...wordRangeIssues(plan.transcript, 120, 240, 'transcript'),
    ...duplicateIssues(plan.gaps.map((g) => g.label), 'gap label'),
    ...plan.gaps.flatMap((gap) => {
      const issues: string[] = [];
      if (wordsIn(gap.answer) > 2) issues.push(`gap ${gap.number}: answer must be one word, number, date or time`);
      if (!/\d/.test(gap.answer) && !spoken.includes(gap.answer.toLowerCase())) {
        issues.push(`gap ${gap.number}: "${gap.answer}" must appear in the transcript exactly as heard`);
      }
      return issues;
    }),
  ];
}

export function completeJudge(plan: KetListenCompleteGen): JudgeRequest {
  return {
    kind: 'open',
    input: {
      text: plan.transcript,
      items: plan.gaps.map((gap) => ({ number: gap.number, claimed: gap.answer, accepted: [gap.answer], sentence: `${gap.label} ___` })),
    },
  };
}

export function decideRules(plan: KetListenDecideGen): string[] {
  return [
    ...numberIssues(plan.items.map((i) => i.number), 'item'),
    ...keyDistributionIssues(plan.items.map((i) => i.answer), 3, 'items'),
    ...wordRangeIssues(plan.conversation.map((t) => t.line).join(' '), 120, 240, 'conversation'),
    ...duplicateIssues(plan.items.map((i) => i.question), 'question'),
    ...plan.items.flatMap((item) => optionIssues(Object.values(item.options), `item ${item.number}`)),
  ];
}

export function decideJudge(plan: KetListenDecideGen): JudgeRequest {
  const source = labelledTranscript(plan.conversation);
  return {
    kind: 'comprehension',
    input: {
      text: source,
      items: plan.items.map((item) => ({
        number: item.number,
        question: item.question,
        options: (['A', 'B', 'C'] as const).map((key) => ({ key, label: item.options[key] })),
        claimed_key: item.answer,
        explanation: 'Detail stated in the conversation.',
        source,
      })),
    },
  };
}

export function shortRules(plan: KetShortConversationsGen): string[] {
  return [
    ...numberIssues(plan.items.map((i) => i.number), 'item'),
    ...keyDistributionIssues(plan.items.map((i) => i.answer), 3, 'items'),
    ...duplicateIssues(plan.items.map((i) => i.context), 'context'),
    ...duplicateIssues(plan.items.map((i) => i.question), 'question'),
    ...plan.items.flatMap((item) => [
      ...wordRangeIssues(item.dialogue.map((t) => t.line).join(' '), 30, 90, `item ${item.number} dialogue`),
      ...optionIssues(Object.values(item.options), `item ${item.number}`),
    ]),
  ];
}

export function shortJudge(plan: KetShortConversationsGen): JudgeRequest {
  return {
    kind: 'comprehension',
    input: {
      text: null,
      items: plan.items.map((item) => ({
        number: item.number,
        question: item.question,
        options: (['A', 'B', 'C'] as const).map((key) => ({ key, label: item.options[key] })),
        claimed_key: item.answer,
        explanation: 'The answer is what the speakers finally say or decide.',
        source: labelledTranscript(item.dialogue),
      })),
    },
  };
}

export function matchRules(plan: KetListenMatchGen): string[] {
  const answers = plan.people.map((p) => p.answer);
  const issues = [
    ...numberIssues(plan.people.map((p) => p.number), 'person'),
    ...wordRangeIssues(plan.conversation.map((t) => t.line).join(' '), 140, 260, 'conversation'),
    ...duplicateIssues(plan.people.map((p) => p.name), 'name'),
    ...duplicateIssues(plan.options.map((o) => o.text), 'option'),
  ];
  if (new Set(answers).size !== answers.length) issues.push('each person must have a different answer letter');
  if (plan.options.map((o) => o.key).join('') !== 'ABCDEFGH') issues.push('options must be labelled A to H in order, once each');
  const spoken = plan.conversation.map((t) => t.line.toLowerCase()).join(' ');
  for (const person of plan.people) {
    if (!spoken.includes(person.name.toLowerCase())) issues.push(`person ${person.number}: ${person.name} must be named in the conversation`);
  }
  return issues;
}

export function matchJudge(plan: KetListenMatchGen): JudgeRequest {
  const source = labelledTranscript(plan.conversation);
  return {
    kind: 'comprehension',
    input: {
      text: source,
      items: plan.people.map((person) => ({
        number: person.number,
        question: `${plan.instruction} ${person.name}?`,
        options: plan.options.map((o) => ({ key: o.key, label: o.text })),
        claimed_key: person.answer,
        explanation: 'The option the conversation finally gives for this person, not one only mentioned as a distractor.',
        source,
      })),
    },
  };
}
