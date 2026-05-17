-- Migration 41: KET Listening Part 1 — Listen and Choose rework
-- Rewrites the generation prompt with modern A2 whitelist and adds framing prompt.

UPDATE public.bob_prompts
SET
  label        = 'KET Listening Part 1 (A2) — generation',
  description  = 'Generates 5 short dialogues + 3-option image prompts for Listen and Choose.',
  prompt_default = $PROMPT$
You are generating a Cambridge A2 Key Listening Part 1 "Listen and Choose" exercise.

## Task
Produce exactly 5 short conversations. Each conversation has:
- A short context label (3–5 words, e.g. "At a café").
- A dialogue of 2–4 turns using alternating speakers M (man) and W (woman).
- Each dialogue is ~35–45 words total.
- One comprehension question.
- Exactly 3 answer options A, B, C, each with:
  - `description`: one short phrase naming what is shown.
  - `image_prompt`: one sentence describing a SINGLE, simple illustration (1–2 objects, plain or very light background, NO text, NO labels, kid-friendly flat vector style).

## Rules
- Vocabulary: use ONLY words from the allowed list below. Prefer common nouns that draw well.
- Distractors: the 3 images must be VISUALLY DISTINCT (different objects or clearly different quantities/colours — never "one cup vs two cups" as the only difference).
- `correct_option` must vary: use A, B, and C across the 5 items (e.g. B, A, C, A, B or similar rotation — never the same letter more than twice in a row).
- Contexts must be 5 different settings: e.g. shop, café/restaurant, school, transport, home/clothes.
- Audio-first: the dialogue must contain enough information to identify the correct option by listening alone. Do NOT describe the images in the dialogue.
- Do NOT use subjective or abstract options (e.g. "a nice day"). All 3 options must be concrete drawable objects.

## Allowed vocabulary (A2 — Cambridge KET)
Animals: bird, cat, dog, duck, fish, frog, horse, mouse, rabbit, snake, spider
Clothes: belt, boots, coat, dress, hat, jacket, jeans, ring, scarf, shirt, shoe, shorts, skirt, sock, sunglasses, sweater, T-shirt, tie, trainers, trousers, umbrella, wallet
Food & drink: apple, banana, biscuit, bowl, bread, burger, butter, cake, carrot, cheese, chips, chocolate, coffee, cup, dish, egg, fork, glass, grapes, juice, knife, lemon, milk, mushroom, noodles, onion, orange, pasta, pea, pear, pie, pizza, plate, rice, salad, sandwich, soup, spoon, strawberry, tea, toast, tomato, water, yoghurt
Home: armchair, bath, bed, bin, bookcase, box, brush, chair, clock, comb, cooker, cupboard, curtain, desk, door, fridge, key, lamp, mirror, oven, pillow, shelf, shower, sink, soap, sofa, table, toothbrush, towel, window
Places: airport, bank, café, hotel, museum, park, restaurant, school, shop, station, supermarket, zoo
School: backpack, book, calculator, computer, eraser, notebook, pen, pencil, ruler, scissors
Sports/music: bike, camera, guitar, helmet, piano, racket, radio, ski, tent, torch, violin, watch
Transport: bicycle, boat, bus, car, lorry, motorbike, plane, taxi, train

## Output JSON (strict)
Return ONLY valid JSON, no markdown, no extra keys.

{
  "items": [
    {
      "number": 1,
      "context": "string — short setting label",
      "dialogue": [
        { "speaker": "M", "line": "string" },
        { "speaker": "W", "line": "string" }
      ],
      "question": "string — comprehension question",
      "options": [
        { "id": "A", "description": "string", "image_prompt": "string" },
        { "id": "B", "description": "string", "image_prompt": "string" },
        { "id": "C", "description": "string", "image_prompt": "string" }
      ],
      "correct_option": "A" | "B" | "C"
    }
  ]
}
$PROMPT$,
  prompt_current = $PROMPT$
You are generating a Cambridge A2 Key Listening Part 1 "Listen and Choose" exercise.

## Task
Produce exactly 5 short conversations. Each conversation has:
- A short context label (3–5 words, e.g. "At a café").
- A dialogue of 2–4 turns using alternating speakers M (man) and W (woman).
- Each dialogue is ~35–45 words total.
- One comprehension question.
- Exactly 3 answer options A, B, C, each with:
  - `description`: one short phrase naming what is shown.
  - `image_prompt`: one sentence describing a SINGLE, simple illustration (1–2 objects, plain or very light background, NO text, NO labels, kid-friendly flat vector style).

## Rules
- Vocabulary: use ONLY words from the allowed list below. Prefer common nouns that draw well.
- Distractors: the 3 images must be VISUALLY DISTINCT (different objects or clearly different quantities/colours — never "one cup vs two cups" as the only difference).
- `correct_option` must vary: use A, B, and C across the 5 items (e.g. B, A, C, A, B or similar rotation — never the same letter more than twice in a row).
- Contexts must be 5 different settings: e.g. shop, café/restaurant, school, transport, home/clothes.
- Audio-first: the dialogue must contain enough information to identify the correct option by listening alone. Do NOT describe the images in the dialogue.
- Do NOT use subjective or abstract options (e.g. "a nice day"). All 3 options must be concrete drawable objects.

## Allowed vocabulary (A2 — Cambridge KET)
Animals: bird, cat, dog, duck, fish, frog, horse, mouse, rabbit, snake, spider
Clothes: belt, boots, coat, dress, hat, jacket, jeans, ring, scarf, shirt, shoe, shorts, skirt, sock, sunglasses, sweater, T-shirt, tie, trainers, trousers, umbrella, wallet
Food & drink: apple, banana, biscuit, bowl, bread, burger, butter, cake, carrot, cheese, chips, chocolate, coffee, cup, dish, egg, fork, glass, grapes, juice, knife, lemon, milk, mushroom, noodles, onion, orange, pasta, pea, pear, pie, pizza, plate, rice, salad, sandwich, soup, spoon, strawberry, tea, toast, tomato, water, yoghurt
Home: armchair, bath, bed, bin, bookcase, box, brush, chair, clock, comb, cooker, cupboard, curtain, desk, door, fridge, key, lamp, mirror, oven, pillow, shelf, shower, sink, soap, sofa, table, toothbrush, towel, window
Places: airport, bank, café, hotel, museum, park, restaurant, school, shop, station, supermarket, zoo
School: backpack, book, calculator, computer, eraser, notebook, pen, pencil, ruler, scissors
Sports/music: bike, camera, guitar, helmet, piano, racket, radio, ski, tent, torch, violin, watch
Transport: bicycle, boat, bus, car, lorry, motorbike, plane, taxi, train

## Output JSON (strict)
Return ONLY valid JSON, no markdown, no extra keys.

{
  "items": [
    {
      "number": 1,
      "context": "string — short setting label",
      "dialogue": [
        { "speaker": "M", "line": "string" },
        { "speaker": "W", "line": "string" }
      ],
      "question": "string — comprehension question",
      "options": [
        { "id": "A", "description": "string", "image_prompt": "string" },
        { "id": "B", "description": "string", "image_prompt": "string" },
        { "id": "C", "description": "string", "image_prompt": "string" }
      ],
      "correct_option": "A" | "B" | "C"
    }
  ]
}
$PROMPT$,
  status = 'coming_soon'
WHERE prompt_key = 'cambridge_ket_listening_part1_a2_generation';

INSERT INTO public.bob_prompts (
  prompt_key, label, description,
  framework, exam_part, cefr_level, activity_type,
  prompt_default, prompt_current, status
) VALUES (
  'cambridge_ket_listening_part1_a2_framing',
  'KET Listening Part 1 (A2) — framing',
  'Brief intro shown to the student before the activity.',
  'cambridge', 'ket_listening_part1', 'a2', 'framing',
  'You will hear 5 short conversations. After each one, choose the picture that matches what you heard — A, B or C. Listen carefully — you can play each conversation again if you need to.',
  'You will hear 5 short conversations. After each one, choose the picture that matches what you heard — A, B or C. Listen carefully — you can play each conversation again if you need to.',
  'enabled'
)
ON CONFLICT (prompt_key) DO UPDATE
  SET prompt_current  = EXCLUDED.prompt_current,
      prompt_default  = EXCLUDED.prompt_default,
      status          = 'enabled';
