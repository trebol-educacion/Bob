export interface ListeningAsset {
  source: string;
  key: string;
  served: boolean;
}

const MODULES = [1, 2] as const;
const QUESTIONS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

const CHOOSE_RESPONSE: ListeningAsset[] = MODULES.flatMap((module) =>
  QUESTIONS.map((question) => ({
    source: `Question Response/Listening${module}_Question Response_Question${question}.ogg`,
    key: `toefl/choose-response/official-m${module}-q${question}.mp3`,
    served: true,
  })),
);

const OFFICIAL_STIMULI: Array<[string, string]> = [
  ['Conversations/Listening1_Conversation_Questions9-10.ogg', 'toefl/official/conversation/m1-q9-10.mp3'],
  ['Conversations/Listening1_Conversation_Questions11-12.ogg', 'toefl/official/conversation/m1-q11-12.mp3'],
  ['Conversations/Listening2_Conversations_Questions9-10.ogg', 'toefl/official/conversation/m2-q9-10.mp3'],
  ['Announcements/Listening1_Announcements_Questions13-14.ogg', 'toefl/official/announcement/m1-q13-14.mp3'],
  ['Announcements/Listening2_Announcements_Questions11-12.ogg', 'toefl/official/announcement/m2-q11-12.mp3'],
  ['Academic Talks/Listening1_Academic Talks_Questions15-18.ogg', 'toefl/official/academic-talk/m1-q15-18.mp3'],
  ['Academic Talks/Listening2_Academic Talks_Questions13-16.ogg', 'toefl/official/academic-talk/m2-q13-16.mp3'],
];

const DIRECTIONS: Array<[string, string]> = [
  ['Conversations/Listening1_Conversation_Directions9-10.ogg', 'toefl/official/conversation/m1-directions-9-10.mp3'],
  ['Conversations/Listening1_Conversation_Directions11-12.ogg', 'toefl/official/conversation/m1-directions-11-12.mp3'],
  ['Conversations/Listening2_Conversation_Directions9-10.ogg', 'toefl/official/conversation/m2-directions-9-10.mp3'],
  ['Announcements/Listening1_Announcements_Directions13-14.ogg', 'toefl/official/announcement/m1-directions-13-14.mp3'],
  ['Announcements/Listening2_Announcements_Directions11-12.ogg', 'toefl/official/announcement/m2-directions-11-12.mp3'],
  ['Academic Talks/Listening1_Academic Talks_Directions15-18.ogg', 'toefl/official/academic-talk/m1-directions-15-18.mp3'],
  ['Academic Talks/Listening2_Academic Talks_Directions13-16.ogg', 'toefl/official/academic-talk/m2-directions-13-16.mp3'],
];

export const TOEFL_LISTENING_ASSETS: ListeningAsset[] = [
  ...CHOOSE_RESPONSE,
  ...OFFICIAL_STIMULI.map(([source, key]) => ({ source, key, served: true })),
  ...DIRECTIONS.map(([source, key]) => ({ source, key, served: false })),
];
