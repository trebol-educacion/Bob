import type { KetListenChooseGen } from '../../src/lib/bank-plans/ket-listening-part1';
import type { KetListenCompleteGen } from '../../src/lib/bank-plans/ket-listening-part2';
import type { KetListenDecideGen } from '../../src/lib/bank-plans/ket-listening-part3';
import type { KetShortTalksGen } from '../../src/lib/bank-plans/ket-listening-part4';
import type { KetTfdsGen } from '../../src/lib/bank-plans/ket-listening-part5';
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

export function talksRules(plan: KetShortTalksGen): string[] {
  const keys = plan.people.map((p) => p.correct_key);
  const issues = [
    ...numberIssues(plan.people.map((p) => p.number), 'person'),
    ...duplicateIssues(plan.people.map((p) => p.name), 'name'),
    ...duplicateIssues(plan.characteristics.map((c) => c.text), 'characteristic'),
  ];
  if (new Set(keys).size !== keys.length) issues.push('each person must have a different correct_key');
  const letters = plan.characteristics.map((c) => c.key).join('');
  if (letters !== 'ABCDEFGH') issues.push('characteristics must be labelled A to H in order, once each');
  for (const person of plan.people) {
    issues.push(...wordRangeIssues(person.monologue, 22, 90, `person ${person.number} monologue`));
    const target = plan.characteristics.find((c) => c.key === person.correct_key)?.text.toLowerCase();
    if (target && person.monologue.toLowerCase().includes(target)) {
      issues.push(`person ${person.number}: the correct characteristic is copied word for word in the monologue`);
    }
  }
  return issues;
}

export function talksJudge(plan: KetShortTalksGen): JudgeRequest {
  return {
    kind: 'comprehension',
    input: {
      text: null,
      items: plan.people.map((person) => ({
        number: person.number,
        question: `Which description fits ${person.name}?`,
        options: plan.characteristics.map((c) => ({ key: c.key, label: c.text })),
        claimed_key: person.correct_key,
        explanation: 'The description that best matches what the person says.',
        source: person.monologue,
      })),
    },
  };
}

const VERDICT_OPTIONS = [
  { key: 'T', label: 'True: the audio says it' },
  { key: 'F', label: 'False: the audio says the opposite' },
  { key: 'DS', label: "Doesn't say: the audio never mentions it" },
];

export function tfdsRules(plan: KetTfdsGen): string[] {
  const verdicts = new Set(plan.statements.map((s) => s.verdict));
  const issues = [
    ...numberIssues(plan.statements.map((s) => s.number), 'statement'),
    ...wordRangeIssues(plan.audio.map((t) => t.line).join(' '), 120, 240, 'audio'),
    ...duplicateIssues(plan.statements.map((s) => s.text), 'statement'),
  ];
  if (verdicts.size < 3) issues.push('use at least one T, one F and one DS statement');
  return issues;
}

export function tfdsJudge(plan: KetTfdsGen): JudgeRequest {
  const source = labelledTranscript(plan.audio);
  return {
    kind: 'comprehension',
    input: {
      text: source,
      items: plan.statements.map((s) => ({
        number: s.number,
        question: s.text,
        options: VERDICT_OPTIONS,
        claimed_key: s.verdict,
        explanation: 'Verdict of the statement against the audio.',
        source,
      })),
    },
  };
}
