import type { BankItem, ItemGroup } from '@/lib/item-bank/types';

const base = {
  exam: 'fce' as const,
  cefr_level: 'b2' as const,
  difficulty: null,
  purpose: 'practice' as const,
  module_code: null,
  stimulus_image_url: null,
  source: 'generated' as const,
  source_ref: null,
  status: 'published' as const,
  reviewed_by: null,
  reviewed_at: null,
  created_at: '2026-09-30T00:00:00.000Z',
};

const itemBase = {
  framework: 'cambridge',
  cefr_level: 'b2' as const,
  stimulus_text: null,
  stimulus_image_url: null,
  source: 'generated' as const,
};

export const SECRET_TRANSCRIPT = 'SECRET-TRANSCRIPT-DO-NOT-LEAK';
export const SECRET_EXPLANATION = 'SECRET-EXPLANATION';

export const R7_SECTIONS = [
  { key: 'A', label: "Maria's Journey to Zero Waste", text: 'I started my sustainable living journey feeling quite lost.' },
  { key: 'B', label: "David's Home Energy Revolution", text: 'For me, tackling our carbon footprint at home was the priority.' },
  { key: 'C', label: "Sarah's Local and Active Lifestyle", text: 'My focus has been on reducing my reliance on cars.' },
  { key: 'D', label: "Tom's Ethical Consumer Choices", text: 'My journey towards sustainable living primarily revolves around shopping.' },
];

export const R7_GROUP: ItemGroup = {
  ...base,
  id: 'r7-group',
  skill: 'reading',
  exam_part: 'fce_reading_part7',
  variant_id: 'gen-r7-001',
  stimulus_text: null,
  stimulus_audio_url: null,
  metadata: {
    title: 'Living Green: Real Stories of Sustainable Choices',
    topic: 'the environment and sustainable living',
    question_range: [43, 52],
    sections: R7_SECTIONS,
    shared_options: R7_SECTIONS.map(({ key, label }) => ({ key, label })),
  },
};

const r7Rows: Array<[string, string]> = [
  ['This person mentions making small, incremental changes to their daily routine.', 'A'],
  ['The writer believes that individual purchasing decisions can have a wide-ranging effect.', 'D'],
  ['This individual appreciates the personal health advantages of their sustainable choices.', 'D'],
  ['The author describes a significant initial financial outlay for their environmental project.', 'B'],
  ['This person feels a sense of satisfaction from contributing positively to their community.', 'C'],
  ['The writer found that their sustainable lifestyle sometimes created social difficulties.', 'D'],
  ['This section highlights how a more eco-friendly approach can also save money in the long term.', 'B'],
  ['The individual mentions an effort to extend the life of their possessions.', 'A'],
  ['The writer values supporting local producers and businesses.', 'C'],
  ['This person was initially overwhelmed by the scale of the changes needed.', 'A'],
];

export const R7_ITEMS: BankItem[] = r7Rows.map(([question, correct_key], index) => ({
  ...itemBase,
  id: `r7-item-${index + 1}`,
  exam_part: 'fce_reading_part7',
  variant_id: `gen-r7-001-q${index + 1}`,
  stimulus_audio_url: null,
  question,
  options: [],
  correct_key,
  explanation: SECRET_EXPLANATION,
  group_id: 'r7-group',
  group_order: index + 1,
  transcript: null,
  metadata: { number: 43 + index, focus: 'detail' },
}));

const L3_OPTIONS = [
  ['A', 'experiencing unexpected enjoyment from a new activity'],
  ['B', 'struggling to maintain enthusiasm for exercise'],
  ['C', 'looking forward to an upcoming competition'],
  ['D', 'feeling satisfied with personal progress'],
  ['E', 'succeeding in spite of a physical challenge'],
  ['F', 'regretting a missed opportunity to get fit'],
  ['G', 'understanding the link between physical activity and mood'],
  ['H', 'finding a team sport too demanding'],
].map(([key, label]) => ({ key, label }));

export const L3_GROUP: ItemGroup = {
  ...base,
  id: 'l3-group',
  skill: 'listening',
  exam_part: 'fce_listening_part3',
  variant_id: 'gen-l3-001',
  stimulus_text: null,
  stimulus_audio_url: null,
  metadata: {
    theme: 'health, sport and wellbeing',
    title: 'B2 First Listening Part 3: Health, Sport and Wellbeing',
    question_range: [19, 23],
    shared_options: L3_OPTIONS,
  },
};

export const L3_ITEMS: BankItem[] = ['E', 'B', 'A', 'G', 'D'].map((correct_key, index) => ({
  ...itemBase,
  id: `l3-item-${index + 1}`,
  exam_part: 'fce_listening_part3',
  variant_id: `gen-l3-001-q${index + 1}`,
  stimulus_audio_url: `/fce-listening-part3/gen-l3-001-s${index + 1}.wav`,
  question: `Speaker ${index + 1}`,
  options: [],
  correct_key,
  explanation: SECRET_EXPLANATION,
  group_id: 'l3-group',
  group_order: index + 1,
  transcript: SECRET_TRANSCRIPT,
  metadata: { number: 19 + index },
}));

export const L2_GROUP: ItemGroup = {
  ...base,
  id: 'l2-group',
  skill: 'listening',
  exam_part: 'fce_listening_part2',
  variant_id: 'gen-l2-001',
  stimulus_text: null,
  stimulus_audio_url: '/fce-listening-part2/gen-l2-001.wav',
  metadata: {
    intro: 'You will hear a report about the ancient Roman city of Pompeii and its historical significance.',
    title: 'Pompeii: A City Frozen in Time',
    topic: 'history and heritage',
    transcript: SECRET_TRANSCRIPT,
    question_range: [9, 18],
  },
};

const l2Rows: Array<[string, string, string[]]> = [
  ['Pompeii is situated near the modern city of Naples and the volcano known as ___9___.', 'mount vesuvius', ['mount vesuvius', 'vesuvius']],
  ['The catastrophic eruption that buried Pompeii occurred in the year ___10___.', '79 ad', ['79 ad', 'ad 79']],
  ['In total, ___11___ major towns were completely covered by volcanic material.', 'two', ['two', '2']],
];

export const L2_ITEMS: BankItem[] = l2Rows.map(([question, correct_key, accepted], index) => ({
  ...itemBase,
  id: `l2-item-${index + 1}`,
  exam_part: 'fce_listening_part2',
  variant_id: `gen-l2-001-q${index + 1}`,
  stimulus_audio_url: null,
  question,
  options: [],
  correct_key,
  explanation: SECRET_EXPLANATION,
  group_id: 'l2-group',
  group_order: index + 1,
  transcript: null,
  metadata: { number: 9 + index, accepted },
}));

export const L4_GROUP: ItemGroup = {
  ...base,
  id: 'l4-group',
  skill: 'listening',
  exam_part: 'fce_listening_part4',
  variant_id: 'gen-l4-001',
  stimulus_text: null,
  stimulus_audio_url: '/fce-listening-part4/gen-l4-001.wav',
  metadata: {
    intro: 'You will hear an interview with Dr. Anya Sharma, an urban agriculture specialist.',
    title: 'Urban Agriculture: Food in Modern Cities',
    topic: 'Food, cities and modern society',
    transcript: SECRET_TRANSCRIPT,
    question_range: [24, 30],
  },
};

const l4Rows: Array<[string, string, string[]]> = [
  ['According to Dr. Sharma, what is currently driving the momentum for food production within cities?', 'B', ['New scientific discoveries in food technology.', 'Growing urban populations and environmental concerns.', 'A decline in the quality of food from rural areas.']],
  ['When discussing urban agriculture, what does Dr. Sharma say is the key principle?', 'B', ['Developing new industrial buildings specifically for indoor farming.', 'Converting existing unused urban areas into food cultivation spaces.', 'Focusing primarily on growing vegetables on balconies and rooftops.']],
  ['What does Dr. Sharma suggest is the most important benefit of urban agriculture for modern society?', 'C', ['The reduction in carbon emissions from food transportation.', 'The greater variety of fresh food available to city dwellers.', 'Its ability to strengthen community bonds and educate people.']],
];

export const L4_ITEMS: BankItem[] = l4Rows.map(([question, correct_key, labels], index) => ({
  ...itemBase,
  id: `l4-item-${index + 1}`,
  exam_part: 'fce_listening_part4',
  variant_id: `gen-l4-001-q${index + 1}`,
  stimulus_audio_url: null,
  question,
  options: labels.map((label, i) => ({ key: 'ABC'[i], label })),
  correct_key,
  explanation: SECRET_EXPLANATION,
  group_id: 'l4-group',
  group_order: index + 1,
  transcript: null,
  metadata: { number: 24 + index, focus: 'detail' },
}));
