export interface OfficialUtterance {
  speaker: 'Woman' | 'Man';
  utterance: string;
  options: [string, string, string, string];
  key: 'A' | 'B' | 'C' | 'D';
}

export interface OfficialModule {
  module: 1 | 2;
  items: OfficialUtterance[];
}

export const OFFICIAL_CHOOSE_RESPONSE: OfficialModule[] = [
  {
    module: 1,
    items: [
      { speaker: 'Woman', utterance: "Didn't I just see you in the library an hour ago?", options: ['As a matter of fact, I was returning a book.', 'Yes, you can find it in the reference section.', "I don't think I'll have enough time to do that.", 'Actually, I think I can get there a little earlier.'], key: 'A' },
      { speaker: 'Man', utterance: 'Where is the nearest bus stop?', options: ['I nearly missed the bus.', 'Every 30 minutes.', 'I can help you find it.', "I'll take the subway instead."], key: 'C' },
      { speaker: 'Woman', utterance: 'How do I contact customer service?', options: ["Yes, you're allowed to do that.", 'Use the convenient chat feature.', "No, I don't mind.", 'They provide good service.'], key: 'B' },
      { speaker: 'Woman', utterance: "I'm afraid I'm not available this evening.", options: ["Oh, that's too early.", 'How about tomorrow night then?', 'She arrived this afternoon.', "No, that's not necessary."], key: 'B' },
      { speaker: 'Man', utterance: "Isn't the post office open today?", options: ["No, it's my package.", "It's just around the corner!", "I think he's come home already.", "Let's check the schedule online."], key: 'D' },
      { speaker: 'Woman', utterance: 'If you need me, just text.', options: ['I can help you with that.', "You don't need any more information.", "You have a lot of questions, don't you?", "You haven't given me your number yet."], key: 'D' },
      { speaker: 'Woman', utterance: 'So the store is open for business all weekend?', options: ['Yes, there is a major power outage.', "Yes, it's under renovation.", "Yes, it's closed all day on Sunday.", "Yes, they're having a huge sale."], key: 'D' },
      { speaker: 'Man', utterance: 'Did you attend the seminar?', options: ['I overslept.', 'No, not very well.', 'Have you asked your professor?', 'I forgot to look.'], key: 'A' },
    ],
  },
  {
    module: 2,
    items: [
      { speaker: 'Woman', utterance: 'Who is the new manager?', options: ['She started last week.', "I'm unsure, but I can find out.", "Let's welcome the new manager.", 'The position has been filled.'], key: 'B' },
      { speaker: 'Man', utterance: 'When is the due date for the report?', options: ['Please wait while I look that up.', 'Give me some dates.', 'No, I have another due date.', "Yes, that's correct."], key: 'A' },
      { speaker: 'Man', utterance: "I'm going to get some groceries.", options: ['Every Wednesday.', 'In aisle 4.', 'The cinema is not open today.', "Let's go together."], key: 'D' },
      { speaker: 'Woman', utterance: 'Would you like a copy of my notes?', options: ['The research facility.', 'That would be great.', 'The break is in an hour.', 'Two bullet points.'], key: 'B' },
      { speaker: 'Man', utterance: 'Sami and Layla are on their way to the café.', options: ['Should we join them?', 'Did you like the concert?', 'Yesterday evening.', 'The best coffee.'], key: 'A' },
      { speaker: 'Woman', utterance: "I'd like to hear your thoughts on the job candidates.", options: ["I'm revising my résumé.", "I'll set up a meeting for us to talk.", 'She just got a promotion.', 'Yes, the training is complete.'], key: 'B' },
      { speaker: 'Woman', utterance: 'How much does expedited shipping cost?', options: ["It's one of many.", 'Twice last week.', "We don't offer that.", "I'd like the bill, please."], key: 'C' },
      { speaker: 'Man', utterance: 'If you need more information, contact Ms. Lee.', options: ['I can help with that.', 'What is her role in the company?', 'You ask a lot of questions.', 'And whom should I contact?'], key: 'B' },
    ],
  },
];
