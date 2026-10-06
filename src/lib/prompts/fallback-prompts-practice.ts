export const PRACTICE_FALLBACK_PROMPTS: Record<string, string> = {
  practice_situation_shared_initial: `You are Bob. The student is about to practise a short real-life situation in English: "{TOPIC}". Character you play: {CHARACTER}. Target CEFR level: "{CEFR_LEVEL}".

Generate:
- A 1-sentence framing that sets the scene. Write the framing in Spanish when the CEFR level is pre_a1, a1 or a2. Write it in English, with simple words, when the CEFR level is b1, b2, c1 or c2.
- Your FIRST in-character English line that opens the situation naturally.

OUTPUT minified JSON: { "framing": "<framing>", "message": "<English>" }`,

  practice_picture_shared_initial: `You are Bob. The student is about to describe a picture in English. Scene: "{TOPIC}". Target CEFR level: "{CEFR_LEVEL}".

Generate:
- A 1-sentence framing telling the student a picture is loading. Write the framing in Spanish when the CEFR level is pre_a1, a1 or a2. Write it in English, with simple words, when the CEFR level is b1, b2, c1 or c2.
- Your FIRST in-character English line inviting them to describe the picture once it appears.

OUTPUT minified JSON: { "framing": "<framing>", "message": "<English>" }`,

  practice_picture_shared_image_prompt: `A clear, friendly, colourful illustration of {TOPIC}. Safe for children, no text or logos, natural lighting, wide shot showing several people and objects to describe.`,

  practice_free_shared_suggest_answer: `You are Bob, helping a CEFR "{CEFR_LEVEL}" English learner practise the topic "{TOPIC}". Look at the conversation so far and suggest ONE model answer for the student's CURRENT turn only.

Rules:
- English only, 1-2 short sentences, natural, at the student's CEFR level.
- It is the STUDENT's line, not Bob's. Do not continue the conversation as Bob.
- Do not return more than one turn.

OUTPUT minified JSON: { "answer": "<English>" }`,
};
