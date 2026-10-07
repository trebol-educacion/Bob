import { PetGapFillDraftSchema, type PetGapFillDraft } from '../../../src/lib/bank-plans/pet-listening-part3';
import { PetJustifyDraftSchema, type PetJustifyDraft } from '../../../src/lib/bank-plans/pet-listening-part5';
import { assetPath, dialogueVoices, soloVoice, speak } from '../assets';
import { stripAllDashes } from '../clean';
import { definePart, type PlanPart } from '../types';
import { duplicateIssues } from '../rules';
import { dialogueText, lengthIssues, PET_LISTENING_TOPICS, themedMessage, turnIssues } from './pet-listening-shared';

const GAP_TOKEN = /\[(\d)\]/g;

function gapIssues(plan: PetGapFillDraft): string[] {
  const issues: string[] = [];
  const found = [...plan.summary.matchAll(GAP_TOKEN)].map((match) => Number(match[1]));
  if (found.join(',') !== '1,2,3,4,5,6') issues.push('summary must contain the gaps [1] to [6] once each and in order');
  const transcript = plan.transcript.toLowerCase();
  const bank = plan.word_bank.map((word) => word.trim().toLowerCase());
  plan.gaps.forEach((gap, index) => {
    if (gap.number !== index + 1) issues.push(`gap ${index + 1}: number must be ${index + 1}`);
    if (!transcript.includes(gap.answer.trim().toLowerCase())) issues.push(`gap ${gap.number}: "${gap.answer}" must be heard in the transcript`);
    if (!bank.includes(gap.answer.trim().toLowerCase())) issues.push(`gap ${gap.number}: "${gap.answer}" must be in the word bank`);
  });
  return [
    ...issues,
    ...duplicateIssues(plan.gaps.map((gap) => gap.answer), 'gap answer'),
    ...duplicateIssues(plan.word_bank, 'word bank'),
    ...lengthIssues(plan.transcript, 90, 135, 'transcript'),
  ];
}

function justifyIssues(plan: PetJustifyDraft): string[] {
  const trues = plan.statements.filter((s) => s.is_true).length;
  const issues = trues >= 2 && trues <= 4 ? [] : ['use between 2 and 4 true statements'];
  plan.statements.forEach((s, index) => {
    if (s.number !== index + 1) issues.push(`statement ${index + 1}: number must be ${index + 1}`);
    if (s.is_true && (s.why_options || s.why_correct)) issues.push(`statement ${s.number}: true statements have no why_options`);
    if (!s.is_true && s.why_options && s.why_correct && !(s.why_correct in s.why_options)) {
      issues.push(`statement ${s.number}: why_correct must be one of the why_options`);
    }
  });
  const keys = plan.statements.flatMap((s) => (s.why_correct ? [s.why_correct] : []));
  if (keys.length >= 3 && new Set(keys).size < 2) issues.push('vary which why_correct key is right');
  return [
    ...issues,
    ...duplicateIssues(plan.statements.map((s) => s.text), 'statement'),
    ...turnIssues(plan.audio, 'audio'),
    ...lengthIssues(plan.audio.map((turn) => turn.line).join(' '), 125, 185, 'audio'),
  ];
}

const gapFill = definePart<PetGapFillDraft>({
  exam: 'pet',
  cefr: 'b1',
  skill: 'listening',
  examPart: 'pet_listening_part3',
  promptKey: 'cambridge_pet_listening_part3_b1_generation',
  short: 'pl3',
  schema: PetGapFillDraftSchema,
  topics: PET_LISTENING_TOPICS,
  message: themedMessage,
  normalize: stripAllDashes,
  rules: gapIssues,
  judge: (plan) => ({
    kind: 'open',
    input: {
      text: `${plan.summary.replace(GAP_TOKEN, '___$1___')}\n\nTRANSCRIPT HEARD BY THE STUDENT:\n${plan.transcript}`,
      items: plan.gaps.map((gap) => ({ number: gap.number, claimed: gap.answer, accepted: [gap.answer, ...gap.accept] })),
    },
  }),
  produce: async (plan, env) => ({
    ...plan,
    audio_url: await speak(env.ai, env.db, `${assetPath(env.examPart, env.variant, 'talk')}.mp3`, plan.transcript, soloVoice(env.slot)),
  }),
  labelOf: (plan) => plan.summary_title,
});

const trueFalse = definePart<PetJustifyDraft>({
  exam: 'pet',
  cefr: 'b1',
  skill: 'listening',
  examPart: 'pet_listening_part5',
  promptKey: 'cambridge_pet_listening_part5_b1_generation',
  short: 'pl5',
  schema: PetJustifyDraftSchema,
  topics: PET_LISTENING_TOPICS,
  message: themedMessage,
  normalize: stripAllDashes,
  rules: justifyIssues,
  judge: (plan) => ({
    kind: 'comprehension',
    input: {
      text: dialogueText(plan.audio),
      items: plan.statements.map((s) => ({
        number: s.number,
        question: `True or false according to the audio: ${s.text}`,
        options: [
          { key: 'T', label: 'True' },
          { key: 'F', label: 'False' },
        ],
        claimed_key: s.is_true ? 'T' : 'F',
        explanation: s.is_true
          ? 'The audio directly confirms the statement.'
          : `The audio contradicts it. Correct information: ${s.why_options?.[s.why_correct ?? 'A'] ?? ''}`,
      })),
    },
  }),
  produce: async (plan, env) => ({
    ...plan,
    audio_url: await speak(env.ai, env.db, `${assetPath(env.examPart, env.variant, 'interview')}.mp3`, dialogueText(plan.audio), dialogueVoices(env.slot)),
  }),
  labelOf: (plan) => plan.context,
});

export const PET_LISTENING_TALK_PARTS: PlanPart[] = [gapFill, trueFalse];
