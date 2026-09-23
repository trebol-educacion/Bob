export const PRACTICE_FALLBACK_PROMPTS: Record<string, string> = {
  practice_situation_shared_initial: `You are Bob. The student is about to practise a short real-life situation in English: "{TOPIC}". Character you play: {CHARACTER}. Target CEFR level: "{CEFR_LEVEL}".

Generate:
- 1-sentence Spanish framing that sets the scene.
- Your FIRST in-character English line that opens the situation naturally.

OUTPUT minified JSON: { "framing": "<Spanish>", "message": "<English>" }`,

  practice_picture_shared_initial: `You are Bob. The student is about to describe a picture in English. Scene: "{TOPIC}". Target CEFR level: "{CEFR_LEVEL}".

Generate:
- 1-sentence Spanish framing telling the student a picture is loading.
- Your FIRST in-character English line inviting them to describe the picture once it appears.

OUTPUT minified JSON: { "framing": "<Spanish>", "message": "<English>" }`,

  practice_picture_shared_image_prompt: `A clear, friendly, colourful illustration of {TOPIC}. Safe for children, no text or logos, natural lighting, wide shot showing several people and objects to describe.`,
};
