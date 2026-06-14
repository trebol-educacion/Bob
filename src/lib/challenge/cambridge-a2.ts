/**
 * Self-contained Cambridge A2 Key challenge exam definition.
 * Independent from the per-skill practice modules; consumed only by the
 * challenge runner. The single sample exam below can later be swapped for
 * pre-generated content by changing the body of `getCambridgeA2Exam`.
 */

import { challengeImages } from './cambridge-a2-images';

export type ChallengeSkill = 'listening' | 'reading' | 'writing' | 'speaking';

export type ChallengeFormat =
  | 'listening_picture_mc'
  | 'listening_note_completion'
  | 'listening_conversation_mc'
  | 'listening_monologue_mc'
  | 'listening_matching'
  | 'reading_notices_mc'
  | 'reading_multiple_matching'
  | 'reading_long_text_mc'
  | 'reading_mc_cloze'
  | 'reading_open_cloze'
  | 'writing_guided_email'
  | 'writing_picture_story'
  | 'speaking_interview'
  | 'speaking_collaborative';

/** A picture choice rendered as a labelled placeholder with an optional real image. */
export interface PictureOption {
  key: string;
  caption: string;
  imageUrl?: string;
}

export interface PictureMcQuestion {
  id: string;
  dialogueScript: string;
  question: string;
  options: PictureOption[];
  answer: string;
}

export interface NoteGap {
  id: string;
  label: string;
  answer: string;
}

export interface TextMcQuestion {
  id: string;
  question: string;
  options: { key: string; text: string }[];
  answer: string;
}

export interface MonologueQuestion {
  id: string;
  speaker: string;
  script: string;
  question: string;
  options: { key: string; text: string }[];
  answer: string;
}

export interface MatchingPerson {
  id: string;
  name: string;
  script: string;
  answer: string;
}

export interface MatchingOption {
  key: string;
  text: string;
}

export interface NoticeQuestion {
  id: string;
  noticeText: string;
  noticeImageUrl?: string;
  question: string;
  options: { key: string; text: string }[];
  answer: string;
}

export interface MatchingText {
  key: string;
  title: string;
  body: string;
  imageUrl?: string;
}

export interface MatchingStatement {
  id: string;
  text: string;
  answer: string;
}

export interface LongTextQuestion {
  id: string;
  question: string;
  options: { key: string; text: string }[];
  answer: string;
}

export interface ClozeGap {
  id: string;
  options: { key: string; text: string }[];
  answer: string;
}

export interface OpenClozeGap {
  id: string;
  answer: string;
}

export interface WritingChecklistItem {
  id: string;
  text: string;
}

export interface SpeakingQuestion {
  id: string;
  text: string;
}

export interface ListeningPictureMcPart {
  format: 'listening_picture_mc';
  playLimit: number;
  questions: PictureMcQuestion[];
}

export interface ListeningNoteCompletionPart {
  format: 'listening_note_completion';
  playLimit: number;
  script: string;
  noteTitle: string;
  gaps: NoteGap[];
}

export interface ListeningConversationMcPart {
  format: 'listening_conversation_mc';
  playLimit: number;
  script: string;
  questions: TextMcQuestion[];
}

export interface ListeningMonologueMcPart {
  format: 'listening_monologue_mc';
  playLimit: number;
  questions: MonologueQuestion[];
}

export interface ListeningMatchingPart {
  format: 'listening_matching';
  playLimit: number;
  people: MatchingPerson[];
  options: MatchingOption[];
}

export interface ReadingNoticesMcPart {
  format: 'reading_notices_mc';
  questions: NoticeQuestion[];
}

export interface ReadingMultipleMatchingPart {
  format: 'reading_multiple_matching';
  texts: MatchingText[];
  statements: MatchingStatement[];
}

export interface ReadingLongTextMcPart {
  format: 'reading_long_text_mc';
  textTitle: string;
  body: string;
  questions: LongTextQuestion[];
}

export interface ReadingMcClozePart {
  format: 'reading_mc_cloze';
  textTitle: string;
  textBefore: string;
  segments: { gap: ClozeGap; textAfter: string }[];
}

export interface ReadingOpenClozePart {
  format: 'reading_open_cloze';
  textTitle: string;
  textBefore: string;
  segments: { gap: OpenClozeGap; textAfter: string }[];
}

export interface WritingGuidedEmailPart {
  format: 'writing_guided_email';
  prompt: string;
  minWords: number;
  checklist: WritingChecklistItem[];
}

export interface WritingPictureStoryPart {
  format: 'writing_picture_story';
  prompt: string;
  minWords: number;
  pictures: PictureOption[];
}

export interface SpeakingInterviewPart {
  format: 'speaking_interview';
  questions: SpeakingQuestion[];
}

export interface SpeakingCollaborativePart {
  format: 'speaking_collaborative';
  prompt: string;
  visual: PictureOption;
  discussionPoints: string[];
}

export type ChallengePartPayload =
  | ListeningPictureMcPart
  | ListeningNoteCompletionPart
  | ListeningConversationMcPart
  | ListeningMonologueMcPart
  | ListeningMatchingPart
  | ReadingNoticesMcPart
  | ReadingMultipleMatchingPart
  | ReadingLongTextMcPart
  | ReadingMcClozePart
  | ReadingOpenClozePart
  | WritingGuidedEmailPart
  | WritingPictureStoryPart
  | SpeakingInterviewPart
  | SpeakingCollaborativePart;

export type ChallengePart = {
  id: string;
  skill: ChallengeSkill;
  title: string;
  instructions: string;
} & ChallengePartPayload;

export interface ChallengeExam {
  framework: 'cambridge_a2_key';
  title: string;
  subtitle: string;
  parts: ChallengePart[];
}

const SAMPLE_EXAM: ChallengeExam = {
  framework: 'cambridge_a2_key',
  title: 'Cambridge A2 Key',
  subtitle: 'Complete certification challenge',
  parts: [
    {
      id: 'L1',
      skill: 'listening',
      title: 'Listening · Part 1',
      instructions:
        'For each question, listen to the short conversation and choose the correct picture. There are five questions. You may play each recording twice.',
      format: 'listening_picture_mc',
      playLimit: 2,
      questions: [
        {
          id: 'L1Q1',
          dialogueScript:
            'Girl: What did you have for breakfast today, Tom? Boy: I wanted toast, but we had no bread, so I ate a banana with some milk.',
          question: 'What did the boy have for breakfast?',
          options: [
            { key: 'A', caption: 'A plate of toast' },
            { key: 'B', caption: 'A banana and a glass of milk' },
            { key: 'C', caption: 'A bowl of cereal' },
          ],
          answer: 'B',
        },
        {
          id: 'L1Q2',
          dialogueScript:
            'Man: How does your sister go to school? Woman: She used to take the bus, but now our dad drives her by car every morning.',
          question: 'How does the sister go to school now?',
          options: [
            { key: 'A', caption: 'By bus' },
            { key: 'B', caption: 'By bike' },
            { key: 'C', caption: 'By car' },
          ],
          answer: 'C',
        },
        {
          id: 'L1Q3',
          dialogueScript:
            'Woman: What is the weather like outside? Boy: It was sunny this morning, but now it is raining, so take your umbrella.',
          question: 'What is the weather like now?',
          options: [
            { key: 'A', caption: 'Sunny sky' },
            { key: 'B', caption: 'Rain and an umbrella' },
            { key: 'C', caption: 'Snow falling' },
          ],
          answer: 'B',
        },
        {
          id: 'L1Q4',
          dialogueScript:
            'Boy: Which pet does your family have? Girl: We wanted a dog, but our flat is small, so we have a cat called Milo.',
          question: 'What pet does the girl have?',
          options: [
            { key: 'A', caption: 'A dog' },
            { key: 'B', caption: 'A cat' },
            { key: 'C', caption: 'A rabbit' },
          ],
          answer: 'B',
        },
        {
          id: 'L1Q5',
          dialogueScript:
            'Man: What time does the film start? Woman: The poster said seven o’clock, but it actually begins at half past seven.',
          question: 'What time does the film start?',
          options: [
            { key: 'A', caption: 'A clock showing 7:00' },
            { key: 'B', caption: 'A clock showing 7:30' },
            { key: 'C', caption: 'A clock showing 8:00' },
          ],
          answer: 'B',
        },
      ],
    },
    {
      id: 'L2',
      skill: 'listening',
      title: 'Listening · Part 2',
      instructions:
        'Listen and complete the notes. Write one word or a number in each gap. There are five gaps. You may play the recording twice.',
      format: 'listening_note_completion',
      playLimit: 2,
      script:
        'Hello everyone, here is some information about our school trip. We are going to the City Science Museum next Friday. The bus leaves at nine o’clock, so please be early. The ticket costs eight pounds. Remember to bring a packed lunch and wear comfortable shoes. We will be back at school by four in the afternoon.',
      noteTitle: 'School trip notes',
      gaps: [
        { id: 'L2G1', label: 'Place: City Science', answer: 'Museum' },
        { id: 'L2G2', label: 'Day: next', answer: 'Friday' },
        { id: 'L2G3', label: 'Bus leaves at', answer: '9' },
        { id: 'L2G4', label: 'Ticket price: £', answer: '8' },
        { id: 'L2G5', label: 'Bring a packed', answer: 'lunch' },
      ],
    },
    {
      id: 'L3',
      skill: 'listening',
      title: 'Listening · Part 3',
      instructions:
        'Listen to the conversation and answer the five questions. For each question, choose A, B or C. You may play the recording twice.',
      format: 'listening_conversation_mc',
      playLimit: 2,
      script:
        'Anna: Hi Ben, are you ready for the weekend? Ben: Yes! On Saturday I am going camping with my cousins near the lake. Anna: That sounds fun. How long are you staying? Ben: Just two nights, we come home on Monday morning. Anna: What will you do there? Ben: We want to go fishing, and my uncle will teach us to cook outside. Anna: Are you taking your phone? Ben: No, there is no signal, so I am taking a book instead. Anna: Great idea. Have a good time!',
      questions: [
        {
          id: 'L3Q1',
          question: 'Where is Ben going at the weekend?',
          options: [
            { key: 'A', text: 'To the beach' },
            { key: 'B', text: 'Camping near a lake' },
            { key: 'C', text: 'To the mountains' },
          ],
          answer: 'B',
        },
        {
          id: 'L3Q2',
          question: 'Who is Ben going with?',
          options: [
            { key: 'A', text: 'His cousins' },
            { key: 'B', text: 'His friends' },
            { key: 'C', text: 'His classmates' },
          ],
          answer: 'A',
        },
        {
          id: 'L3Q3',
          question: 'When does Ben come home?',
          options: [
            { key: 'A', text: 'On Saturday' },
            { key: 'B', text: 'On Sunday' },
            { key: 'C', text: 'On Monday' },
          ],
          answer: 'C',
        },
        {
          id: 'L3Q4',
          question: 'What will Ben learn to do?',
          options: [
            { key: 'A', text: 'Cook outside' },
            { key: 'B', text: 'Swim in the lake' },
            { key: 'C', text: 'Ride a horse' },
          ],
          answer: 'A',
        },
        {
          id: 'L3Q5',
          question: 'What is Ben taking instead of his phone?',
          options: [
            { key: 'A', text: 'A camera' },
            { key: 'B', text: 'A book' },
            { key: 'C', text: 'A game' },
          ],
          answer: 'B',
        },
      ],
    },
    {
      id: 'L4',
      skill: 'listening',
      title: 'Listening · Part 4',
      instructions:
        'You will hear five short monologues. For each speaker, answer the question by choosing A, B or C. You may play each recording twice.',
      format: 'listening_monologue_mc',
      playLimit: 2,
      questions: [
        {
          id: 'L4Q1',
          speaker: 'Speaker 1',
          script:
            'I love the weekends because I can finally relax. I usually sleep late, then I help my mum make pancakes for the family. After lunch I meet my friends in the park.',
          question: 'What does the speaker do first at the weekend?',
          options: [
            { key: 'A', text: 'Meets friends' },
            { key: 'B', text: 'Sleeps late' },
            { key: 'C', text: 'Goes to the park' },
          ],
          answer: 'B',
        },
        {
          id: 'L4Q2',
          speaker: 'Speaker 2',
          script:
            'My favourite subject at school is art. I am not very good at maths, and history is a bit boring, but in art class I can draw and paint anything I want.',
          question: 'What is the speaker’s favourite subject?',
          options: [
            { key: 'A', text: 'Maths' },
            { key: 'B', text: 'History' },
            { key: 'C', text: 'Art' },
          ],
          answer: 'C',
        },
        {
          id: 'L4Q3',
          speaker: 'Speaker 3',
          script:
            'For my birthday I wanted a new bike, but my parents gave me a tablet instead. My grandma sent me some money, so maybe I will buy the bike myself.',
          question: 'What did the speaker get for their birthday?',
          options: [
            { key: 'A', text: 'A bike' },
            { key: 'B', text: 'A tablet' },
            { key: 'C', text: 'Some clothes' },
          ],
          answer: 'B',
        },
        {
          id: 'L4Q4',
          speaker: 'Speaker 4',
          script:
            'We went on holiday to the seaside last summer. The hotel was nice, but it rained a lot, so we spent most days at the swimming pool indoors.',
          question: 'Where did the speaker spend most of the holiday?',
          options: [
            { key: 'A', text: 'On the beach' },
            { key: 'B', text: 'At the indoor pool' },
            { key: 'C', text: 'In the hotel room' },
          ],
          answer: 'B',
        },
        {
          id: 'L4Q5',
          speaker: 'Speaker 5',
          script:
            'I take the train to work every day. It is faster than the bus and cheaper than driving. The only problem is that it gets very crowded in the morning.',
          question: 'Why does the speaker take the train?',
          options: [
            { key: 'A', text: 'It is faster and cheaper' },
            { key: 'B', text: 'It is never crowded' },
            { key: 'C', text: 'It is close to home' },
          ],
          answer: 'A',
        },
      ],
    },
    {
      id: 'L5',
      skill: 'listening',
      title: 'Listening · Part 5',
      instructions:
        'Listen to each person and match them with the correct option from A to H. There are five people and eight options, so three options are extra. You may play the recordings twice.',
      format: 'listening_matching',
      playLimit: 2,
      people: [
        { id: 'L5P1', name: 'Maria', script: 'At the weekend Maria likes to bake cakes and biscuits for her family.', answer: 'C' },
        { id: 'L5P2', name: 'James', script: 'James spends his free time playing football with his team on Saturdays.', answer: 'A' },
        { id: 'L5P3', name: 'Sofia', script: 'Sofia loves reading adventure stories in the library after school.', answer: 'E' },
        { id: 'L5P4', name: 'Leo', script: 'Leo enjoys taking photos of birds and animals in the countryside.', answer: 'G' },
        { id: 'L5P5', name: 'Emma', script: 'Emma practises the guitar every evening because she wants to be in a band.', answer: 'B' },
      ],
      options: [
        { key: 'A', text: 'Playing football' },
        { key: 'B', text: 'Playing music' },
        { key: 'C', text: 'Baking' },
        { key: 'D', text: 'Painting' },
        { key: 'E', text: 'Reading' },
        { key: 'F', text: 'Dancing' },
        { key: 'G', text: 'Taking photos' },
        { key: 'H', text: 'Swimming' },
      ],
    },
    {
      id: 'R1',
      skill: 'reading',
      title: 'Reading · Part 1',
      instructions:
        'For each question, read the notice or short text and choose the answer (A, B or C) that means the same. There are five questions.',
      format: 'reading_notices_mc',
      questions: [
        {
          id: 'R1Q1',
          noticeText: 'LIBRARY CLOSED ON MONDAY FOR CLEANING. OPEN AGAIN TUESDAY AT 9 A.M.',
          question: 'What does the notice tell you?',
          options: [
            { key: 'A', text: 'The library is open every day.' },
            { key: 'B', text: 'The library is shut on Monday.' },
            { key: 'C', text: 'The library opens late on Tuesday.' },
          ],
          answer: 'B',
        },
        {
          id: 'R1Q2',
          noticeText: 'Mum – Your football kit is washed and on your bed. Don’t forget your water bottle! Love, Dad',
          question: 'Why did Dad write this message?',
          options: [
            { key: 'A', text: 'To ask for help with washing' },
            { key: 'B', text: 'To remind about a water bottle' },
            { key: 'C', text: 'To cancel a football game' },
          ],
          answer: 'B',
        },
        {
          id: 'R1Q3',
          noticeText: 'CAFE: Free glass of juice with every sandwich before 11 a.m.',
          question: 'How can you get free juice?',
          options: [
            { key: 'A', text: 'Buy a sandwich in the morning' },
            { key: 'B', text: 'Come after eleven o’clock' },
            { key: 'C', text: 'Order two drinks' },
          ],
          answer: 'A',
        },
        {
          id: 'R1Q4',
          noticeText: 'SWIMMING POOL: Children under 8 must come with an adult.',
          question: 'What must young children do?',
          options: [
            { key: 'A', text: 'Pay more money' },
            { key: 'B', text: 'Bring an adult with them' },
            { key: 'C', text: 'Swim only in the morning' },
          ],
          answer: 'B',
        },
        {
          id: 'R1Q5',
          noticeText: 'School Trip: Bring your form back by Friday or you cannot come.',
          question: 'What happens if you do not bring the form by Friday?',
          options: [
            { key: 'A', text: 'You pay double' },
            { key: 'B', text: 'You cannot go on the trip' },
            { key: 'C', text: 'You go on a different day' },
          ],
          answer: 'B',
        },
      ],
    },
    {
      id: 'R2',
      skill: 'reading',
      title: 'Reading · Part 2',
      instructions:
        'Read about three people and answer the seven questions. For each question, choose person A, B or C.',
      format: 'reading_multiple_matching',
      texts: [
        {
          key: 'A',
          title: 'Daniel',
          body:
            'Daniel is twelve and lives in a town near the mountains. Every winter he goes skiing with his older brother. He plays the piano and wants to be a music teacher. At weekends he helps his grandfather in the garden.',
        },
        {
          key: 'B',
          title: 'Priya',
          body:
            'Priya is thirteen and loves the sea. She lives by the coast and goes swimming all year. She has a small dog called Coco. Her favourite subject is science, and she dreams of becoming a doctor one day.',
        },
        {
          key: 'C',
          title: 'Marco',
          body:
            'Marco is eleven and lives in a big city. He travels everywhere by bike. He collects comic books and draws his own cartoons. On Saturdays he goes to a cooking class with his mother.',
        },
      ],
      statements: [
        { id: 'R2Q1', text: 'Who has a pet?', answer: 'B' },
        { id: 'R2Q2', text: 'Who likes to draw?', answer: 'C' },
        { id: 'R2Q3', text: 'Who plays a musical instrument?', answer: 'A' },
        { id: 'R2Q4', text: 'Who wants to work in a hospital?', answer: 'B' },
        { id: 'R2Q5', text: 'Who goes skiing in winter?', answer: 'A' },
        { id: 'R2Q6', text: 'Who learns to cook?', answer: 'C' },
        { id: 'R2Q7', text: 'Who travels around the city by bike?', answer: 'C' },
      ],
    },
    {
      id: 'R3',
      skill: 'reading',
      title: 'Reading · Part 3',
      instructions:
        'Read the article and answer the five questions. For each question, choose A, B or C.',
      format: 'reading_long_text_mc',
      textTitle: 'My First Week at a New School',
      body:
        'When my family moved to a new city last September, I was very nervous about starting at a new school. On my first day, I did not know anyone, and I got lost trying to find my classroom. A girl called Lucy saw that I looked worried and showed me the way. We have been friends ever since.\n\nThe school is much bigger than my old one. There are three computer rooms and a huge sports hall. At first I found it difficult to remember where everything was, but after a few days it became easier. My favourite place is the library, because it is quiet and I can read there at lunchtime.\n\nThe teachers are friendly, although the homework is harder than before. The thing I like most is the science club, which meets on Wednesdays. Last week we did an experiment with magnets, and next week we are going to make a small volcano. I am really glad we moved here.',
      questions: [
        {
          id: 'R3Q1',
          question: 'How did the writer feel on the first day?',
          options: [
            { key: 'A', text: 'Excited' },
            { key: 'B', text: 'Nervous' },
            { key: 'C', text: 'Bored' },
          ],
          answer: 'B',
        },
        {
          id: 'R3Q2',
          question: 'Who helped the writer find the classroom?',
          options: [
            { key: 'A', text: 'A teacher' },
            { key: 'B', text: 'A girl called Lucy' },
            { key: 'C', text: 'The writer’s brother' },
          ],
          answer: 'B',
        },
        {
          id: 'R3Q3',
          question: 'What is the writer’s favourite place at school?',
          options: [
            { key: 'A', text: 'The sports hall' },
            { key: 'B', text: 'The computer room' },
            { key: 'C', text: 'The library' },
          ],
          answer: 'C',
        },
        {
          id: 'R3Q4',
          question: 'What does the writer say about the homework?',
          options: [
            { key: 'A', text: 'It is harder than before' },
            { key: 'B', text: 'It is easier than before' },
            { key: 'C', text: 'There is no homework' },
          ],
          answer: 'A',
        },
        {
          id: 'R3Q5',
          question: 'What will the science club do next week?',
          options: [
            { key: 'A', text: 'Use magnets' },
            { key: 'B', text: 'Make a volcano' },
            { key: 'C', text: 'Visit a museum' },
          ],
          answer: 'B',
        },
      ],
    },
    {
      id: 'R4',
      skill: 'reading',
      title: 'Reading · Part 4',
      instructions:
        'Read the text and choose the correct word (A, B or C) for each gap. There are six gaps.',
      format: 'reading_mc_cloze',
      textTitle: 'A Day at the Market',
      textBefore: 'Every Saturday morning my grandmother and I go to the local market. We always ',
      segments: [
        {
          gap: {
            id: 'R4G1',
            options: [
              { key: 'A', text: 'arrive' },
              { key: 'B', text: 'arrival' },
              { key: 'C', text: 'arriving' },
            ],
            answer: 'A',
          },
          textAfter: ' early because the best fruit sells quickly. My grandmother ',
        },
        {
          gap: {
            id: 'R4G2',
            options: [
              { key: 'A', text: 'buy' },
              { key: 'B', text: 'buys' },
              { key: 'C', text: 'buying' },
            ],
            answer: 'B',
          },
          textAfter: ' fresh vegetables, and I choose some ',
        },
        {
          gap: {
            id: 'R4G3',
            options: [
              { key: 'A', text: 'delicious' },
              { key: 'B', text: 'deliciously' },
              { key: 'C', text: 'delicate' },
            ],
            answer: 'A',
          },
          textAfter: ' strawberries. The market is ',
        },
        {
          gap: {
            id: 'R4G4',
            options: [
              { key: 'A', text: 'more busy' },
              { key: 'B', text: 'busiest' },
              { key: 'C', text: 'busier' },
            ],
            answer: 'C',
          },
          textAfter: ' than the supermarket, but the food is cheaper. We ',
        },
        {
          gap: {
            id: 'R4G5',
            options: [
              { key: 'A', text: 'usually' },
              { key: 'B', text: 'usual' },
              { key: 'C', text: 'use' },
            ],
            answer: 'A',
          },
          textAfter: ' stop for a hot drink before we ',
        },
        {
          gap: {
            id: 'R4G6',
            options: [
              { key: 'A', text: 'go' },
              { key: 'B', text: 'went' },
              { key: 'C', text: 'gone' },
            ],
            answer: 'A',
          },
          textAfter: ' home. It is my favourite part of the week.',
        },
      ],
    },
    {
      id: 'R5',
      skill: 'reading',
      title: 'Reading · Part 5',
      instructions:
        'Read the text and write one word for each gap. There are six gaps. Write only one word in each space.',
      format: 'reading_open_cloze',
      textTitle: 'An Email to a Friend',
      textBefore: 'Hi Sara,\n\nThank you for your email. I am very happy ',
      segments: [
        { gap: { id: 'R5G1', answer: 'to' }, textAfter: ' hear that you are coming to visit me next month. There ' },
        { gap: { id: 'R5G2', answer: 'are' }, textAfter: ' so many things we can do together. We could go ' },
        { gap: { id: 'R5G3', answer: 'to' }, textAfter: ' the beach if the weather is nice, or we ' },
        { gap: { id: 'R5G4', answer: 'can' }, textAfter: ' watch a film at home. My mum says you can stay ' },
        { gap: { id: 'R5G5', answer: 'with' }, textAfter: ' us for the whole week. Please tell me ' },
        { gap: { id: 'R5G6', answer: 'what' }, textAfter: ' food you like, so we can buy it before you arrive.\n\nSee you soon,\nMia' },
      ],
    },
    {
      id: 'W6',
      skill: 'writing',
      title: 'Writing · Part 6',
      instructions:
        'You want to invite your English friend Alex to your birthday party. Write an email to Alex. Write 25 words or more. Cover all three points below.',
      format: 'writing_guided_email',
      prompt:
        'Write an email to your friend Alex about your birthday party.',
      minWords: 25,
      checklist: [
        { id: 'W6C1', text: 'Say when and where the party is.' },
        { id: 'W6C2', text: 'Tell Alex what you will do at the party.' },
        { id: 'W6C3', text: 'Ask Alex to bring something.' },
      ],
    },
    {
      id: 'W7',
      skill: 'writing',
      title: 'Writing · Part 7',
      instructions:
        'Look at the three pictures. Write the story shown in the pictures. Write 35 words or more.',
      format: 'writing_picture_story',
      prompt: 'Tell the story shown in the three pictures below.',
      minWords: 35,
      pictures: [
        { key: '1', caption: 'A boy finds a lost dog in the rain near a park bench.' },
        { key: '2', caption: 'The boy takes the dog home and gives it food and a towel.' },
        { key: '3', caption: 'A happy family comes to the boy’s house to collect their dog.' },
      ],
    },
    {
      id: 'S1',
      skill: 'speaking',
      title: 'Speaking · Part 1',
      instructions:
        'This is the interview. Answer each question out loud. Record your answer or simply speak it aloud. You will receive supportive, qualitative feedback — there is no exam score here.',
      format: 'speaking_interview',
      questions: [
        { id: 'S1Q1', text: 'What is your name and how old are you?' },
        { id: 'S1Q2', text: 'Where do you live, and what do you like about it?' },
        { id: 'S1Q3', text: 'What do you usually do after school?' },
        { id: 'S1Q4', text: 'Tell me about your favourite food.' },
        { id: 'S1Q5', text: 'What did you do last weekend?' },
      ],
    },
    {
      id: 'S2',
      skill: 'speaking',
      title: 'Speaking · Part 2',
      instructions:
        'This is the collaborative task. Look at the picture and talk about it, using the points below to help you. You will receive supportive, qualitative feedback — there is no exam score here.',
      format: 'speaking_collaborative',
      prompt: 'A family is planning a weekend trip. Talk about where they could go and what they could take.',
      visual: {
        key: 'S2V',
        caption: 'A family looking at a map together with a backpack, a camera and a picnic basket on the table.',
      },
      discussionPoints: [
        'Where could the family go?',
        'How could they travel there?',
        'What should they take with them?',
        'What activities could they do?',
      ],
    },
  ],
};

/**
 * Stable slot keys for every pre-generated image in the exam. Shared by the
 * pre-generation script and the read-time merge so both agree on the mapping.
 */
export const CHALLENGE_IMAGE_SLOTS: { key: string; description: string }[] = SAMPLE_EXAM.parts
  .flatMap((part): { key: string; description: string }[] => {
    if (part.format === 'listening_picture_mc') {
      return part.questions.flatMap((q) =>
        q.options.map((o) => ({ key: `${q.id}:${o.key}`, description: o.caption }))
      );
    }
    if (part.format === 'reading_notices_mc') {
      return part.questions.map((q) => ({ key: q.id, description: q.noticeText }));
    }
    if (part.format === 'writing_picture_story') {
      return part.pictures.map((p) => ({ key: `${part.id}:${p.key}`, description: p.caption }));
    }
    if (part.format === 'speaking_collaborative') {
      return [{ key: `${part.id}:${part.visual.key}`, description: part.visual.caption }];
    }
    return [];
  });

type ImageMap = Record<string, string>;

function mergeImageUrls(exam: ChallengeExam, images: ImageMap): ChallengeExam {
  return {
    ...exam,
    parts: exam.parts.map((part): ChallengePart => {
      if (part.format === 'listening_picture_mc') {
        return {
          ...part,
          questions: part.questions.map((q) => ({
            ...q,
            options: q.options.map((o) => {
              const url = images[`${q.id}:${o.key}`];
              return url ? { ...o, imageUrl: url } : o;
            }),
          })),
        };
      }
      if (part.format === 'reading_notices_mc') {
        return {
          ...part,
          questions: part.questions.map((q) => {
            const url = images[q.id];
            return url ? { ...q, noticeImageUrl: url } : q;
          }),
        };
      }
      if (part.format === 'writing_picture_story') {
        return {
          ...part,
          pictures: part.pictures.map((p) => {
            const url = images[`${part.id}:${p.key}`];
            return url ? { ...p, imageUrl: url } : p;
          }),
        };
      }
      if (part.format === 'speaking_collaborative') {
        const url = images[`${part.id}:${part.visual.key}`];
        return url ? { ...part, visual: { ...part.visual, imageUrl: url } } : part;
      }
      return part;
    }),
  };
}

/**
 * Returns the active Cambridge A2 Key challenge exam with pre-generated image
 * URLs merged in from `cambridge-a2-images.json`. Slots with no entry keep
 * `imageUrl` undefined so the component falls back to its placeholder.
 */
export function getCambridgeA2Exam(): ChallengeExam {
  return mergeImageUrls(SAMPLE_EXAM, challengeImages as ImageMap);
}
