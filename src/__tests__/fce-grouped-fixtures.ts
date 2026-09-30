import type { BankItem, ItemGroup } from '@/lib/item-bank/types';

export function makeGroup(examPart: string, overrides: Partial<ItemGroup>): ItemGroup {
  return {
    id: `group-${examPart}`,
    exam: 'fce',
    skill: 'reading',
    cefr_level: 'b2',
    difficulty: null,
    purpose: 'practice',
    module_code: null,
    exam_part: examPart,
    variant_id: 'gen-001',
    metadata: {},
    stimulus_text: null,
    stimulus_audio_url: null,
    stimulus_image_url: null,
    source: 'generated',
    source_ref: null,
    status: 'published',
    reviewed_by: null,
    reviewed_at: null,
    created_at: '2026-09-30T00:00:00.000Z',
    ...overrides,
  };
}

export function makeItem(examPart: string, order: number, overrides: Partial<BankItem>): BankItem {
  return {
    id: `item-${examPart}-${order}`,
    framework: 'cambridge',
    exam_part: examPart,
    cefr_level: 'b2',
    variant_id: `gen-001-q${order}`,
    stimulus_audio_url: null,
    stimulus_text: null,
    stimulus_image_url: null,
    question: String(order),
    options: [],
    correct_key: '',
    explanation: null,
    source: 'generated',
    group_id: `group-${examPart}`,
    group_order: order,
    transcript: null,
    metadata: null,
    ...overrides,
  };
}

export const OPEN_CLOZE_GROUP = makeGroup('fce_reading_part2', {
  stimulus_text:
    'From the moment we wake up ___0___ the alarm, it is hard to imagine a world ___9___ digital tools. Many people rely ___10___ them, ___11___ it brings concerns.',
  metadata: {
    title: 'The Digital Revolution',
    topic: 'technology',
    example: { answer: 'to', number: 0 },
    question_range: [9, 11],
  },
});

export const OPEN_CLOZE_ITEMS: BankItem[] = [
  makeItem('fce_reading_part2', 1, {
    question: '9',
    correct_key: 'without',
    metadata: { number: 9, focus: 'preposition', accepted: ['without'] },
  }),
  makeItem('fce_reading_part2', 2, {
    question: '10',
    correct_key: 'on',
    metadata: { number: 10, accepted: ['on'] },
  }),
  makeItem('fce_reading_part2', 3, {
    question: '11',
    correct_key: 'although',
    metadata: { number: 11, accepted: ['although', 'while', 'whilst'] },
  }),
];

export const WORD_FORMATION_GROUP = makeGroup('fce_reading_part3', {
  stimulus_text:
    'Lifelong learning has become ___0___ (INCREASE) important. It can be filled with ___17___ (FRUSTRATE). It requires ___18___ (DEDICATE).',
  metadata: {
    title: 'Lifelong Learning',
    example: { answer: 'increasingly', number: 0, base_word: 'INCREASE' },
    question_range: [17, 18],
  },
});

export const WORD_FORMATION_ITEMS: BankItem[] = [
  makeItem('fce_reading_part3', 1, {
    question: '17',
    correct_key: 'frustration',
    metadata: { number: 17, accepted: ['frustration'], base_word: 'FRUSTRATE', transformation: 'verb to noun' },
  }),
  makeItem('fce_reading_part3', 2, {
    question: '18',
    correct_key: 'dedication',
    metadata: { number: 18, accepted: ['dedication'], base_word: 'DEDICATE' },
  }),
];

export const KEY_WORD_GROUP = makeGroup('fce_reading_part4', {
  metadata: { title: 'Key word transformation', question_range: [25, 26] },
});

export const KEY_WORD_ITEMS: BankItem[] = [
  makeItem('fce_reading_part4', 1, {
    question: 'People say that the mayor is very committed.',
    correct_key: 'is said to be',
    metadata: {
      number: 25,
      keyword: 'SAID',
      accepted: ['is said to be'],
      structure: 'impersonal passive',
      second_sentence_with_gap: 'The mayor ________ very committed.',
    },
  }),
  makeItem('fce_reading_part4', 2, {
    question: 'Many residents find it difficult to attend meetings.',
    correct_key: 'have difficulty attending',
    metadata: {
      number: 26,
      keyword: 'DIFFICULTY',
      accepted: ['have difficulty attending', 'have difficulty in attending'],
      second_sentence_with_gap: 'Many residents ________ meetings.',
    },
  }),
];

const CHOICES = (labels: string[]) => labels.map((label, i) => ({ key: 'ABCD'[i], label }));

export const MULTIPLE_CHOICE_GROUP = makeGroup('fce_reading_part5', {
  stimulus_text: 'Travel is often seen as a simple journey.\n\nHowever, beneath this surface lies a profound potential.',
  metadata: { title: 'Beyond the Postcard', topic: 'travel', question_range: [31, 32] },
});

export const MULTIPLE_CHOICE_ITEMS: BankItem[] = [
  makeItem('fce_reading_part5', 1, {
    question: 'The first paragraph highlights that cultural exchange:',
    options: CHOICES(['transforms the individual.', 'collects landscapes.', 'ticks landmarks.', 'is relaxing.']),
    correct_key: 'A',
    explanation: 'Secret explanation',
    metadata: { number: 31, focus: 'detail' },
  }),
  makeItem('fce_reading_part5', 2, {
    question: "The author's attitude to bubble travel is:",
    options: CHOICES(['neutral.', 'critical.', 'supportive.', 'confused.']),
    correct_key: 'B',
    metadata: { number: 32, focus: 'opinion' },
  }),
];

export const GAPPED_TEXT_GROUP = makeGroup('fce_reading_part6', {
  stimulus_text: 'Science is a quest. ___37___ Every day researchers push boundaries. ___38___ The end.',
  metadata: {
    title: 'Unlocking the Universe',
    topic: 'science',
    extra_key: 'F',
    question_range: [37, 38],
    shared_options: [
      { key: 'A', label: 'Sentence A.' },
      { key: 'B', label: 'Sentence B.' },
      { key: 'C', label: 'Sentence C.' },
    ],
  },
});

export const GAPPED_TEXT_ITEMS: BankItem[] = [
  makeItem('fce_reading_part6', 1, {
    question: '37',
    correct_key: 'C',
    metadata: { number: 37, link_type: 'lexical reference' },
  }),
  makeItem('fce_reading_part6', 2, {
    question: '38',
    correct_key: 'A',
    metadata: { number: 38, link_type: 'connector' },
  }),
];
