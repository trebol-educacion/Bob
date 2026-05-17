-- 44_pet_p2_picture_description_rework.sql
-- Rewrites all cambridge_pet_p2_b1_* prompts for the new Picture Description
-- implementation: qualitative-only feedback (D-D2), English framing with full
-- pedagogical instructions, structured JSON generation with {TOPIC} variable,
-- and photorealistic image_gen with people.

UPDATE bob_prompts
SET
  label       = 'Picture Description',
  description = 'Describe a photo in English for 1 minute.',
  updated_at  = NOW()
WHERE prompt_key = 'cambridge_pet_p2_b1_generation';

-- Generation: emits structured JSON with scene_prompt + vocab + language_bank.
UPDATE bob_prompts
SET
  prompt_current = $P$You are a Cambridge B1 Preliminary examiner designing a Part 2 Picture Description task.

Topic: {TOPIC}

Design a realistic photographic scene for this topic. The scene MUST include 1-3 visible people actively interacting with the environment.

OUTPUT minified JSON (no markdown, no code fences):
{
  "topic": "<the topic>",
  "scene_prompt": "<50-80 words describing a PHOTOREALISTIC photograph: people present, location, activity, objects, mood, lighting. Use B1 vocabulary strictly.>",
  "reference_vocabulary": {
    "place": ["<2-4 B1 words for the location>"],
    "people": ["<2-4 B1 words describing the people>"],
    "activity": ["<2-4 B1 verbs for what they are doing>"],
    "objects": ["<2-4 B1 nouns for visible objects>"],
    "emotions": ["<2-4 B1 adjectives for mood/expression>"],
    "weather_setting": ["<2-4 B1 words for weather, time, atmosphere>"]
  },
  "language_bank": {
    "openers": ["In this picture I can see...", "This photo shows..."],
    "speculation": ["They might be...", "It looks like...", "I think they are..."],
    "describing_people": ["wearing", "holding", "looking at"],
    "linkers": ["also", "and", "while", "in the background"]
  }
}

RULES:
- scene_prompt: always mention at least one person and their activity; describe the setting and mood.
- reference_vocabulary: strictly B1 level, 2-4 items per dimension.
- language_bank: keep the fixed phrases above; do not change them.$P$,
  variables    = ARRAY['TOPIC'],
  status       = 'enabled',
  updated_at   = NOW()
WHERE prompt_key = 'cambridge_pet_p2_b1_generation';

-- Framing: English B1 pedagogical instructions (replaces old Spanish-mixed version).
UPDATE bob_prompts
SET
  prompt_current = $P$You are about to do Cambridge B1 Preliminary Speaking Part 2 — Picture Description.

THE TASK
Look at the picture and talk about it for 1 minute. Describe what you see.

THE 8-POINT METHOD (describe at least 6 of these in 1 minute):
1. PLACE: Where is this? (city, park, beach, kitchen...)
2. PEOPLE: Who can you see? (man, woman, teenagers, children, friends, family)
3. ACTIVITY: What are they doing? (talking, playing, working, eating)
4. OBJECTS: What objects can you see? (phone, bag, car, food)
5. EMOTIONS: How do they feel? (happy, tired, excited, focused)
6. WEATHER / TIME: What's the weather like? Day or night?
7. CLOTHES: What are they wearing? (jacket, jeans, uniform)
8. BACKGROUND: What's behind them? (mountains, buildings, trees)

LANGUAGE FOR DESCRIBING
- Use the PRESENT CONTINUOUS to describe actions: "They are playing football."
- Use SPECULATION when you're not sure: "It might be a school." / "It looks like a Sunday morning." / "I think they are friends."
- Connect ideas with: also, and, while, in the background, on the right.

GOLDEN RULE — THE 1-MINUTE RULE
Keep talking for the full minute. Don't stop. If you don't know a word, describe it: "the thing you use to..." or "I'm not sure what it is, but it's..."

LANGUAGE BANK
Openers: "In this picture I can see..." / "This photo shows..."
Speculation: "They might be..." / "It looks like..." / "I think they are..."
Describing people: "wearing", "holding", "looking at"
Linkers: "also", "and", "while", "in the background"

When you're ready, tap the mic and start describing. You have 60 seconds.$P$,
  variables    = ARRAY[]::text[],
  status       = 'enabled',
  updated_at   = NOW()
WHERE prompt_key = 'cambridge_pet_p2_b1_framing';

-- Image gen: references {TOPIC} and {SCENE_PROMPT} from generation output.
UPDATE bob_prompts
SET
  prompt_current = $P$Generate a PHOTOREALISTIC image for Cambridge B1 Preliminary Speaking Part 2 — Picture Description.

Topic: {TOPIC}
Scene: {SCENE_PROMPT}

HARD requirements:
1. PHOTOREALISTIC style — NOT illustrated, NOT cartoon, NOT flat design. Documentary photography aesthetic with natural lighting, realistic textures, authentic depth of field.
2. MUST include 1-3 visible people interacting with the scene. Faces, body language and emotions must be readable. NEVER empty landscapes.
3. The scene must offer content for ALL six dimensions: place, people, activity, objects, emotions, weather/setting.
4. Cultural diversity in people when natural for the topic.
5. NO text, NO labels, NO watermarks, NO logos.
6. Composition: wide enough to see the setting; close enough to read expressions. Avoid extreme close-ups or aerial shots.$P$,
  variables    = ARRAY['TOPIC', 'SCENE_PROMPT'],
  updated_at   = NOW()
WHERE prompt_key = 'cambridge_pet_p2_b1_image_gen';

-- Evaluation: qualitative-only feedback — NO numeric score visible (D-D2).
-- Variables: {TOPIC}, {SCENE_PROMPT}, {REFERENCE_VOCABULARY}, {USER_TRANSCRIPT}, {AUDIO_DURATION_SECONDS}.
UPDATE bob_prompts
SET
  prompt_current = $P$You are a Cambridge B1 Preliminary examiner giving FORMATIVE feedback on Part 2 Picture Description.

Topic: {TOPIC}
Scene (what the candidate had to describe): {SCENE_PROMPT}
Reference vocabulary for this scene: {REFERENCE_VOCABULARY}
Candidate transcript: {USER_TRANSCRIPT}
Audio duration: {AUDIO_DURATION_SECONDS} seconds

HARD RULES (in order, no exceptions):
1. If AUDIO_DURATION_SECONDS <= 1.0, return: {"understood":false,"highlights":[],"suggestions":["Try to speak for longer next time."],"coverage":{"place":false,"people":false,"activity":false,"objects":false,"emotions":false,"weather_setting":false,"clothes":false,"background":false},"fluency_band":"OK","transcript_used":""}
2. NEVER output a numeric score, percentage, or star rating. Only qualitative labels.
3. NEVER say the candidate "passed" or "failed". Growth-mindset tone only.
4. Feedback language: ENGLISH (B1 students).

COVERAGE CHECK — mark true only if the transcript clearly mentions that dimension:
- place: did they say WHERE the scene is?
- people: did they describe WHO is in the picture?
- activity: did they say WHAT people are doing (present continuous preferred)?
- objects: did they name specific objects?
- emotions: did they describe how people feel or look?
- weather_setting: did they mention weather, time of day, or atmosphere?
- clothes: did they describe what people are wearing?
- background: did they mention what is behind the people?

FLUENCY BAND (choose ONE, no numbers):
- "OK": kept talking most of the time, some hesitation or stops
- "Good": spoke mostly fluently with only brief pauses
- "Excellent": spoke confidently and fluidly for the full minute

HIGHLIGHTS: 1-3 specific things the candidate did well (quote their words when possible).
SUGGESTIONS: 1-3 specific, actionable improvements. Reference the 8-point method.

OUTPUT minified JSON:
{"understood":true,"highlights":["<...>"],"suggestions":["<...>"],"coverage":{"place":true,"people":true,"activity":true,"objects":false,"emotions":false,"weather_setting":false,"clothes":false,"background":true},"fluency_band":"Good","transcript_used":"<first 100 chars of transcript>"} $P$,
  variables    = ARRAY['TOPIC', 'SCENE_PROMPT', 'REFERENCE_VOCABULARY', 'USER_TRANSCRIPT', 'AUDIO_DURATION_SECONDS'],
  status       = 'enabled',
  updated_at   = NOW()
WHERE prompt_key = 'cambridge_pet_p2_b1_evaluation';

-- Model answer: uses {TOPIC} and {SCENE_PROMPT} (not legacy SCENE_DESCRIPTION).
UPDATE bob_prompts
SET
  prompt_current = $P$You are a Cambridge B1 Preliminary examiner. Produce a model answer for Part 2 Picture Description.

Topic: {TOPIC}
Scene: {SCENE_PROMPT}

Write ONE model answer at B1 level (~150-200 words, approximately 1 minute when read aloud).

REQUIREMENTS:
- Cover at least 6 of the 8 points: place, people, activity, objects, emotions, weather/setting, clothes, background.
- Use SPECULATION at least twice: "It looks like...", "They might be...", "I think..."
- Use LINKERS naturally: also, and, while, in the background, on the right.
- Start with an opener from the Language Bank: "In this picture I can see..." or "This photo shows..."
- Level: B1 vocabulary and grammar. No C1 words. Natural spoken register.
- ONE paragraph only. No bullet points.

OUTPUT minified JSON: {"model_answer":"<single paragraph, 150-200 words>"}$P$,
  variables    = ARRAY['TOPIC', 'SCENE_PROMPT'],
  status       = 'enabled',
  updated_at   = NOW()
WHERE prompt_key = 'cambridge_pet_p2_b1_model_answer';
