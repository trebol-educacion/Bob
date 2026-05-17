-- Migration 33: A2 vocabulary seed (Cambridge accumulative model)
--
-- Sources:
--   • 149681-yle-flyers-word-list.pdf — A2 Flyers wordlist (thematic + A-Z, words marked F)
--   • Cambridge A2 Key Vocabulary List PDF.pdf — A2 Key/KET topic lists
--
-- Strategy (Opción A — accumulative vocab):
--   1. Copy all cambridge/a1 rows → cambridge/a2 (Cambridge vocab is cumulative).
--   2. Insert new A2-level nouns NOT already at a1. Words that are A1 get picked up by
--      the copy above; the inserts below only add words first appearing at A2.
--
-- Category decisions for KET-only words without Flyers thematic grouping:
--   • gym, maths, science, history, geography, language, timetable, university → school
--   • ambulance, hospital, medicine, bandage, headache, etc. → health
--   • email, internet, laptop, website, wifi, app, CD, DVD, etc. → tech
--   • airport, bus station, castle, hotel, museum, restaurant, etc. → places
--   • bicycle, fire engine, taxi, tram, motorway, railway, etc. → transport
--   • actor, singer, nurse, pilot, etc. → people
--   • drum, violin, chess, festival, concert, film, cinema, etc. → sports_music
--   • air, autumn, cave, desert, fire, fog, grass, hill, ice, island, etc. → nature
--   • butter, cheese, coffee, fork, jam, knife, pizza, soup, yoghurt, etc. → food_drink
--   • bracelet, necklace, ring, sunglasses, trainers, uniform → clothes
--   • body parts (elbow, finger, knee, neck, shoulder, stomach, toe, tooth) → body
--   • screen, fridge, oven, shower, garage, curtain, etc. → home
--   • money, newspaper, postcard, surprise, surname, etc. → misc

-- ─── Step 1: copy a1 → a2 ────────────────────────────────────────────────────
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly)
SELECT framework, 'a2', category, word, word_type, pointable, object_card_friendly
FROM public.bob_vocabulary
WHERE cefr_level = 'a1' AND framework = 'cambridge'
ON CONFLICT DO NOTHING;

-- ─── Step 2: new A2 words — animals ─────────────────────────────────────────
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly, notes) VALUES
  ('cambridge', 'a2', 'animals', 'beetle',    'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'animals', 'creature',  'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'animals', 'dinosaur',  'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'animals', 'eagle',     'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'animals', 'fur',       'noun', false, false, NULL),
  ('cambridge', 'a2', 'animals', 'insect',    'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'animals', 'nest',      'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'animals', 'octopus',   'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'animals', 'swan',      'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'animals', 'tortoise',  'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'animals', 'wing',      'noun', true,  true,  NULL)
ON CONFLICT DO NOTHING;

-- ─── Step 2: new A2 words — body ─────────────────────────────────────────────
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly, notes) VALUES
  ('cambridge', 'a2', 'body', 'elbow',    'noun', true, false, NULL),
  ('cambridge', 'a2', 'body', 'finger',   'noun', true, false, NULL),
  ('cambridge', 'a2', 'body', 'knee',     'noun', true, false, NULL),
  ('cambridge', 'a2', 'body', 'neck',     'noun', true, false, NULL),
  ('cambridge', 'a2', 'body', 'shoulder', 'noun', true, false, NULL),
  ('cambridge', 'a2', 'body', 'stomach',  'noun', true, false, NULL),
  ('cambridge', 'a2', 'body', 'toe',      'noun', true, false, NULL),
  ('cambridge', 'a2', 'body', 'tooth',    'noun', true, false, 'plural: teeth')
ON CONFLICT DO NOTHING;

-- ─── Step 2: new A2 words — clothes ──────────────────────────────────────────
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly, notes) VALUES
  ('cambridge', 'a2', 'clothes', 'bracelet',   'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'clothes', 'coat',        'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'clothes', 'costume',     'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'clothes', 'crown',       'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'clothes', 'necklace',    'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'clothes', 'pajamas',     'noun', true,  true,  'UK: pyjamas'),
  ('cambridge', 'a2', 'clothes', 'pocket',      'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'clothes', 'purse',       'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'clothes', 'raincoat',    'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'clothes', 'ring',        'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'clothes', 'spot',        'noun', false, false, 'pattern on fabric'),
  ('cambridge', 'a2', 'clothes', 'stripe',      'noun', false, false, NULL),
  ('cambridge', 'a2', 'clothes', 'suit',        'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'clothes', 'sunglasses',  'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'clothes', 'tie',         'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'clothes', 'tights',      'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'clothes', 'trainers',    'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'clothes', 'uniform',     'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'clothes', 'wallet',      'noun', true,  true,  NULL)
ON CONFLICT DO NOTHING;

-- ─── Step 2: new A2 words — food_drink ───────────────────────────────────────
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly, notes) VALUES
  ('cambridge', 'a2', 'food_drink', 'barbecue',      'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'bottle',        'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'breakfast',     'noun', false, false, NULL),
  ('cambridge', 'a2', 'food_drink', 'butter',        'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'cereal',        'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'cheese',        'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'chilli',        'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'chips',         'noun', true,  true,  'UK: crisps; US: fries'),
  ('cambridge', 'a2', 'food_drink', 'chopsticks',    'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'coffee',        'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'cola',          'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'cream',         'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'cup',           'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'curry',         'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'dessert',       'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'dinner',        'noun', false, false, NULL),
  ('cambridge', 'a2', 'food_drink', 'dish',          'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'flour',         'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'fork',          'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'garlic',        'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'honey',         'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'jam',           'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'knife',         'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'lunch',         'noun', false, false, NULL),
  ('cambridge', 'a2', 'food_drink', 'main course',   'noun', false, false, NULL),
  ('cambridge', 'a2', 'food_drink', 'meal',          'noun', false, false, NULL),
  ('cambridge', 'a2', 'food_drink', 'menu',          'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'milkshake',     'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'mineral water', 'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'mushroom',      'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'noodles',       'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'oil',           'noun', false, false, NULL),
  ('cambridge', 'a2', 'food_drink', 'olives',        'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'omelette',      'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'pancake',       'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'pasta',         'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'pepper',        'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'picnic',        'noun', false, false, NULL),
  ('cambridge', 'a2', 'food_drink', 'piece',         'noun', false, false, NULL),
  ('cambridge', 'a2', 'food_drink', 'pizza',         'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'plate',         'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'salad',         'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'salt',          'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'sandwich',      'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'sauce',         'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'slice',         'noun', false, false, NULL),
  ('cambridge', 'a2', 'food_drink', 'snack',         'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'soup',          'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'spoon',         'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'steak',         'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'sugar',         'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'tea',           'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'toast',         'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'vegetable',     'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'food_drink', 'yoghurt',       'noun', true,  true,  'also: yogurt')
ON CONFLICT DO NOTHING;

-- ─── Step 2: new A2 words — home ─────────────────────────────────────────────
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly, notes) VALUES
  ('cambridge', 'a2', 'home', 'bin',          'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'home', 'brush',        'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'home', 'comb',         'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'home', 'cooker',       'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'home', 'curtain',      'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'home', 'cushion',      'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'home', 'drawer',       'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'home', 'entrance',     'noun', true,  false, NULL),
  ('cambridge', 'a2', 'home', 'envelope',     'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'home', 'fridge',       'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'home', 'furniture',    'noun', false, false, NULL),
  ('cambridge', 'a2', 'home', 'garage',       'noun', true,  false, NULL),
  ('cambridge', 'a2', 'home', 'gate',         'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'home', 'heating',      'noun', false, false, NULL),
  ('cambridge', 'a2', 'home', 'key',          'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'home', 'letter',       'noun', true,  true,  'as in mail'),
  ('cambridge', 'a2', 'home', 'lift',         'noun', true,  true,  'UK elevator'),
  ('cambridge', 'a2', 'home', 'light',        'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'home', 'living room',  'noun', false, false, NULL),
  ('cambridge', 'a2', 'home', 'oven',         'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'home', 'pillow',       'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'home', 'refrigerator', 'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'home', 'roof',         'noun', true,  false, NULL),
  ('cambridge', 'a2', 'home', 'rubbish',      'noun', false, false, NULL),
  ('cambridge', 'a2', 'home', 'screen',       'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'home', 'shampoo',      'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'home', 'shower',       'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'home', 'sink',         'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'home', 'soap',         'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'home', 'stamp',        'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'home', 'swing',        'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'home', 'telephone',    'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'home', 'toilet',       'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'home', 'toothbrush',   'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'home', 'toothpaste',   'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'home', 'washing machine', 'noun', true, true, NULL)
ON CONFLICT DO NOTHING;

-- ─── Step 2: new A2 words — nature ───────────────────────────────────────────
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly, notes) VALUES
  ('cambridge', 'a2', 'nature', 'air',       'noun', false, false, NULL),
  ('cambridge', 'a2', 'nature', 'autumn',    'noun', false, false, 'US: fall'),
  ('cambridge', 'a2', 'nature', 'bridge',    'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'nature', 'cave',      'noun', true,  false, NULL),
  ('cambridge', 'a2', 'nature', 'desert',    'noun', true,  false, NULL),
  ('cambridge', 'a2', 'nature', 'earth',     'noun', false, false, NULL),
  ('cambridge', 'a2', 'nature', 'fire',      'noun', true,  false, NULL),
  ('cambridge', 'a2', 'nature', 'fog',       'noun', false, false, NULL),
  ('cambridge', 'a2', 'nature', 'grass',     'noun', true,  false, NULL),
  ('cambridge', 'a2', 'nature', 'hill',      'noun', true,  false, NULL),
  ('cambridge', 'a2', 'nature', 'ice',       'noun', false, false, NULL),
  ('cambridge', 'a2', 'nature', 'island',    'noun', true,  false, NULL),
  ('cambridge', 'a2', 'nature', 'land',      'noun', false, false, NULL),
  ('cambridge', 'a2', 'nature', 'leaf',      'noun', true,  true,  'plural: leaves'),
  ('cambridge', 'a2', 'nature', 'mountain',  'noun', true,  false, NULL),
  ('cambridge', 'a2', 'nature', 'ocean',     'noun', false, false, NULL),
  ('cambridge', 'a2', 'nature', 'path',      'noun', true,  false, NULL),
  ('cambridge', 'a2', 'nature', 'planet',    'noun', true,  false, NULL),
  ('cambridge', 'a2', 'nature', 'plant',     'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'nature', 'pond',      'noun', true,  false, NULL),
  ('cambridge', 'a2', 'nature', 'rain',      'noun', false, false, NULL),
  ('cambridge', 'a2', 'nature', 'rainbow',   'noun', true,  false, NULL),
  ('cambridge', 'a2', 'nature', 'sky',       'noun', false, false, NULL),
  ('cambridge', 'a2', 'nature', 'snow',      'noun', false, false, NULL),
  ('cambridge', 'a2', 'nature', 'space',     'noun', false, false, NULL),
  ('cambridge', 'a2', 'nature', 'spring',    'noun', false, false, 'season'),
  ('cambridge', 'a2', 'nature', 'star',      'noun', true,  false, NULL),
  ('cambridge', 'a2', 'nature', 'stone',     'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'nature', 'storm',     'noun', false, false, NULL),
  ('cambridge', 'a2', 'nature', 'stream',    'noun', true,  false, NULL),
  ('cambridge', 'a2', 'nature', 'summer',    'noun', false, false, NULL),
  ('cambridge', 'a2', 'nature', 'waterfall', 'noun', true,  false, NULL),
  ('cambridge', 'a2', 'nature', 'weather',   'noun', false, false, NULL),
  ('cambridge', 'a2', 'nature', 'wind',      'noun', false, false, NULL),
  ('cambridge', 'a2', 'nature', 'winter',    'noun', false, false, NULL),
  ('cambridge', 'a2', 'nature', 'wood',      'noun', true,  false, 'area of trees'),
  ('cambridge', 'a2', 'nature', 'world',     'noun', false, false, NULL)
ON CONFLICT DO NOTHING;

-- ─── Step 2: new A2 words — people / family / jobs ───────────────────────────
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly, notes) VALUES
  ('cambridge', 'a2', 'people', 'actor',         'noun', true,  false, NULL),
  ('cambridge', 'a2', 'people', 'artist',        'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'astronaut',     'noun', true,  false, NULL),
  ('cambridge', 'a2', 'people', 'aunt',          'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'businessman',   'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'businesswoman', 'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'child',         'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'clown',         'noun', true,  false, NULL),
  ('cambridge', 'a2', 'people', 'cousin',        'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'dad',           'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'daughter',      'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'dentist',       'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'designer',      'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'doctor',        'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'driver',        'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'engineer',      'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'explorer',      'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'family',        'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'farmer',        'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'father',        'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'fire fighter',  'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'friend',        'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'granddaughter', 'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'grandfather',   'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'grandma',       'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'grandmother',   'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'grandpa',       'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'grandparent',   'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'grandson',      'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'granny',        'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'grown-up',      'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'guest',         'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'guide',         'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'husband',       'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'journalist',    'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'king',          'noun', true,  false, NULL),
  ('cambridge', 'a2', 'people', 'manager',       'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'mechanic',      'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'mother',        'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'mum',           'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'musician',      'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'neighbour',     'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'nurse',         'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'parent',        'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'passenger',     'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'photographer',  'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'pilot',         'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'pirate',        'noun', true,  false, NULL),
  ('cambridge', 'a2', 'people', 'police officer','noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'pop star',      'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'queen',         'noun', true,  false, NULL),
  ('cambridge', 'a2', 'people', 'receptionist',  'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'secretary',     'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'singer',        'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'sister',        'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'son',           'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'student',       'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'teenager',      'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'uncle',         'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'waiter',        'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'waitress',      'noun', false, false, NULL),
  ('cambridge', 'a2', 'people', 'wife',          'noun', false, false, NULL)
ON CONFLICT DO NOTHING;

-- ─── Step 2: new A2 words — school / education ───────────────────────────────
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly, notes) VALUES
  ('cambridge', 'a2', 'school', 'art',          'noun',  false, false, NULL),
  ('cambridge', 'a2', 'school', 'backpack',     'noun',  true,  true,  'UK: rucksack'),
  ('cambridge', 'a2', 'school', 'biology',      'noun',  false, false, NULL),
  ('cambridge', 'a2', 'school', 'blackboard',   'noun',  true,  true,  NULL),
  ('cambridge', 'a2', 'school', 'chemistry',    'noun',  false, false, NULL),
  ('cambridge', 'a2', 'school', 'class',        'noun',  false, false, NULL),
  ('cambridge', 'a2', 'school', 'classmate',    'noun',  false, false, NULL),
  ('cambridge', 'a2', 'school', 'classroom',    'noun',  false, false, NULL),
  ('cambridge', 'a2', 'school', 'college',      'noun',  false, false, NULL),
  ('cambridge', 'a2', 'school', 'competition',  'noun',  false, false, NULL),
  ('cambridge', 'a2', 'school', 'flag',         'noun',  true,  true,  NULL),
  ('cambridge', 'a2', 'school', 'geography',    'noun',  false, false, NULL),
  ('cambridge', 'a2', 'school', 'group',        'noun',  false, false, NULL),
  ('cambridge', 'a2', 'school', 'gym',          'noun',  true,  false, NULL),
  ('cambridge', 'a2', 'school', 'history',      'noun',  false, false, NULL),
  ('cambridge', 'a2', 'school', 'homework',     'noun',  false, false, NULL),
  ('cambridge', 'a2', 'school', 'language',     'noun',  false, false, NULL),
  ('cambridge', 'a2', 'school', 'lesson',       'noun',  false, false, NULL),
  ('cambridge', 'a2', 'school', 'library',      'noun',  true,  false, NULL),
  ('cambridge', 'a2', 'school', 'maths',        'noun',  false, false, 'US: math'),
  ('cambridge', 'a2', 'school', 'physics',      'noun',  false, false, NULL),
  ('cambridge', 'a2', 'school', 'project',      'noun',  false, false, NULL),
  ('cambridge', 'a2', 'school', 'rucksack',     'noun',  true,  true,  'US: backpack'),
  ('cambridge', 'a2', 'school', 'science',      'noun',  false, false, NULL),
  ('cambridge', 'a2', 'school', 'subject',      'noun',  false, false, NULL),
  ('cambridge', 'a2', 'school', 'timetable',    'noun',  true,  true,  NULL),
  ('cambridge', 'a2', 'school', 'university',   'noun',  false, false, NULL)
ON CONFLICT DO NOTHING;

-- ─── Step 2: new A2 words — sports_music / leisure ───────────────────────────
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly, notes) VALUES
  ('cambridge', 'a2', 'sports_music', 'cartoon',      'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'sports_music', 'channel',      'noun', false, false, NULL),
  ('cambridge', 'a2', 'sports_music', 'chess',        'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'sports_music', 'cinema',       'noun', true,  false, NULL),
  ('cambridge', 'a2', 'sports_music', 'club',         'noun', false, false, NULL),
  ('cambridge', 'a2', 'sports_music', 'concert',      'noun', false, false, NULL),
  ('cambridge', 'a2', 'sports_music', 'cycling',      'noun', false, false, NULL),
  ('cambridge', 'a2', 'sports_music', 'disco',        'noun', false, false, NULL),
  ('cambridge', 'a2', 'sports_music', 'drum',         'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'sports_music', 'festival',     'noun', false, false, NULL),
  ('cambridge', 'a2', 'sports_music', 'film',         'noun', false, false, 'US: movie'),
  ('cambridge', 'a2', 'sports_music', 'golf',         'noun', false, false, NULL),
  ('cambridge', 'a2', 'sports_music', 'instrument',   'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'sports_music', 'invitation',   'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'sports_music', 'magazine',     'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'sports_music', 'match',        'noun', false, false, 'sports match'),
  ('cambridge', 'a2', 'sports_music', 'member',       'noun', false, false, NULL),
  ('cambridge', 'a2', 'sports_music', 'music',        'noun', false, false, NULL),
  ('cambridge', 'a2', 'sports_music', 'pop music',    'noun', false, false, NULL),
  ('cambridge', 'a2', 'sports_music', 'prize',        'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'sports_music', 'programme',    'noun', false, false, 'US: program'),
  ('cambridge', 'a2', 'sports_music', 'puzzle',       'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'sports_music', 'quiz',         'noun', false, false, NULL),
  ('cambridge', 'a2', 'sports_music', 'race',         'noun', false, false, NULL),
  ('cambridge', 'a2', 'sports_music', 'rock music',   'noun', false, false, NULL),
  ('cambridge', 'a2', 'sports_music', 'score',        'noun', false, false, NULL),
  ('cambridge', 'a2', 'sports_music', 'sledge',       'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'sports_music', 'snowball',     'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'sports_music', 'snowboard',    'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'sports_music', 'snowboarding', 'noun', false, false, NULL),
  ('cambridge', 'a2', 'sports_music', 'snowman',      'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'sports_music', 'stage',        'noun', true,  false, 'theatre stage'),
  ('cambridge', 'a2', 'sports_music', 'suitcase',     'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'sports_music', 'team',         'noun', false, false, NULL),
  ('cambridge', 'a2', 'sports_music', 'tent',         'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'sports_music', 'theatre',      'noun', true,  false, 'US: theater'),
  ('cambridge', 'a2', 'sports_music', 'ticket',       'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'sports_music', 'torch',        'noun', true,  true,  'US: flashlight'),
  ('cambridge', 'a2', 'sports_music', 'tune',         'noun', false, false, NULL),
  ('cambridge', 'a2', 'sports_music', 'video game',   'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'sports_music', 'violin',       'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'sports_music', 'volleyball',   'noun', false, false, NULL),
  ('cambridge', 'a2', 'sports_music', 'winner',       'noun', false, false, NULL)
ON CONFLICT DO NOTHING;

-- ─── Step 2: new A2 words — transport ────────────────────────────────────────
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly, notes) VALUES
  ('cambridge', 'a2', 'transport', 'ambulance',   'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'transport', 'bicycle',     'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'transport', 'fire engine', 'noun', true,  true,  'US: fire truck'),
  ('cambridge', 'a2', 'transport', 'flight',      'noun', false, false, NULL),
  ('cambridge', 'a2', 'transport', 'journey',     'noun', false, false, NULL),
  ('cambridge', 'a2', 'transport', 'luggage',     'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'transport', 'motorway',    'noun', true,  false, NULL),
  ('cambridge', 'a2', 'transport', 'passport',    'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'transport', 'platform',    'noun', true,  false, NULL),
  ('cambridge', 'a2', 'transport', 'racing car',  'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'transport', 'railway',     'noun', false, false, NULL),
  ('cambridge', 'a2', 'transport', 'rocket',      'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'transport', 'spaceship',   'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'transport', 'taxi',        'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'transport', 'tour',        'noun', false, false, NULL),
  ('cambridge', 'a2', 'transport', 'traffic',     'noun', false, false, NULL),
  ('cambridge', 'a2', 'transport', 'tram',        'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'transport', 'trip',        'noun', false, false, NULL),
  ('cambridge', 'a2', 'transport', 'wheel',       'noun', true,  true,  NULL)
ON CONFLICT DO NOTHING;

-- ─── Step 2: new A2 words — places (buildings / town) ────────────────────────
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly, notes) VALUES
  ('cambridge', 'a2', 'places', 'airport',         'noun', true,  false, NULL),
  ('cambridge', 'a2', 'places', 'bank',            'noun', true,  false, NULL),
  ('cambridge', 'a2', 'places', 'bus station',     'noun', true,  false, NULL),
  ('cambridge', 'a2', 'places', 'bus stop',        'noun', true,  false, NULL),
  ('cambridge', 'a2', 'places', 'cafe',            'noun', true,  false, 'also: café'),
  ('cambridge', 'a2', 'places', 'car park',        'noun', true,  false, NULL),
  ('cambridge', 'a2', 'places', 'castle',          'noun', true,  false, NULL),
  ('cambridge', 'a2', 'places', 'chemist',         'noun', true,  false, 'UK pharmacy'),
  ('cambridge', 'a2', 'places', 'cinema',          'noun', true,  false, NULL),
  ('cambridge', 'a2', 'places', 'city',            'noun', false, false, NULL),
  ('cambridge', 'a2', 'places', 'corner',          'noun', true,  false, NULL),
  ('cambridge', 'a2', 'places', 'factory',         'noun', true,  false, NULL),
  ('cambridge', 'a2', 'places', 'fire station',    'noun', true,  false, NULL),
  ('cambridge', 'a2', 'places', 'hotel',           'noun', true,  false, NULL),
  ('cambridge', 'a2', 'places', 'market',          'noun', true,  false, NULL),
  ('cambridge', 'a2', 'places', 'museum',          'noun', true,  false, NULL),
  ('cambridge', 'a2', 'places', 'office',          'noun', true,  false, NULL),
  ('cambridge', 'a2', 'places', 'playground',      'noun', true,  false, NULL),
  ('cambridge', 'a2', 'places', 'police station',  'noun', true,  false, NULL),
  ('cambridge', 'a2', 'places', 'post office',     'noun', true,  false, NULL),
  ('cambridge', 'a2', 'places', 'railway station', 'noun', true,  false, NULL),
  ('cambridge', 'a2', 'places', 'restaurant',      'noun', true,  false, NULL),
  ('cambridge', 'a2', 'places', 'road',            'noun', true,  false, NULL),
  ('cambridge', 'a2', 'places', 'skyscraper',      'noun', true,  false, NULL),
  ('cambridge', 'a2', 'places', 'sports centre',   'noun', true,  false, NULL),
  ('cambridge', 'a2', 'places', 'stadium',         'noun', true,  false, NULL),
  ('cambridge', 'a2', 'places', 'street',          'noun', true,  false, NULL),
  ('cambridge', 'a2', 'places', 'supermarket',     'noun', true,  false, NULL),
  ('cambridge', 'a2', 'places', 'swimming pool',   'noun', true,  false, NULL),
  ('cambridge', 'a2', 'places', 'town',            'noun', false, false, NULL),
  ('cambridge', 'a2', 'places', 'village',         'noun', false, false, NULL),
  ('cambridge', 'a2', 'places', 'zoo',             'noun', true,  false, NULL)
ON CONFLICT DO NOTHING;

-- ─── Step 2: new A2 words — health ───────────────────────────────────────────
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly, notes) VALUES
  ('cambridge', 'a2', 'health', 'accident',     'noun', false, false, NULL),
  ('cambridge', 'a2', 'health', 'appointment',  'noun', false, false, NULL),
  ('cambridge', 'a2', 'health', 'bandage',      'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'health', 'blood',        'noun', false, false, NULL),
  ('cambridge', 'a2', 'health', 'brain',        'noun', true,  false, NULL),
  ('cambridge', 'a2', 'health', 'cold',         'noun', false, false, 'illness'),
  ('cambridge', 'a2', 'health', 'cough',        'noun', false, false, NULL),
  ('cambridge', 'a2', 'health', 'earache',      'noun', false, false, NULL),
  ('cambridge', 'a2', 'health', 'exercise',     'noun', false, false, NULL),
  ('cambridge', 'a2', 'health', 'headache',     'noun', false, false, NULL),
  ('cambridge', 'a2', 'health', 'heart',        'noun', true,  false, NULL),
  ('cambridge', 'a2', 'health', 'hospital',     'noun', true,  false, NULL),
  ('cambridge', 'a2', 'health', 'medicine',     'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'health', 'pain',         'noun', false, false, NULL),
  ('cambridge', 'a2', 'health', 'stomach ache', 'noun', false, false, NULL),
  ('cambridge', 'a2', 'health', 'temperature',  'noun', false, false, NULL),
  ('cambridge', 'a2', 'health', 'toothache',    'noun', false, false, NULL),
  ('cambridge', 'a2', 'health', 'x-ray',        'noun', true,  false, NULL)
ON CONFLICT DO NOTHING;

-- ─── Step 2: new A2 words — tech / communication ─────────────────────────────
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly, notes) VALUES
  ('cambridge', 'a2', 'tech', 'app',        'noun', false, false, NULL),
  ('cambridge', 'a2', 'tech', 'CD',         'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'tech', 'DVD',        'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'tech', 'email',      'noun', false, false, NULL),
  ('cambridge', 'a2', 'tech', 'internet',   'noun', false, false, NULL),
  ('cambridge', 'a2', 'tech', 'laptop',     'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'tech', 'message',    'noun', false, false, NULL),
  ('cambridge', 'a2', 'tech', 'mobile',     'noun', true,  true,  'mobile phone'),
  ('cambridge', 'a2', 'tech', 'password',   'noun', false, false, NULL),
  ('cambridge', 'a2', 'tech', 'printer',    'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'tech', 'software',   'noun', false, false, NULL),
  ('cambridge', 'a2', 'tech', 'web page',   'noun', false, false, NULL),
  ('cambridge', 'a2', 'tech', 'website',    'noun', false, false, NULL),
  ('cambridge', 'a2', 'tech', 'wifi',       'noun', false, false, NULL)
ON CONFLICT DO NOTHING;

-- ─── Step 2: new A2 words — misc (time, money, abstract nouns) ───────────────
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly, notes) VALUES
  ('cambridge', 'a2', 'misc', 'address',      'noun', false, false, NULL),
  ('cambridge', 'a2', 'misc', 'age',          'noun', false, false, NULL),
  ('cambridge', 'a2', 'misc', 'business',     'noun', false, false, NULL),
  ('cambridge', 'a2', 'misc', 'calendar',     'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'misc', 'card',         'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'misc', 'century',      'noun', false, false, NULL),
  ('cambridge', 'a2', 'misc', 'conversation', 'noun', false, false, NULL),
  ('cambridge', 'a2', 'misc', 'date',         'noun', false, false, 'as in calendar date'),
  ('cambridge', 'a2', 'misc', 'diary',        'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'misc', 'east',         'noun', false, false, NULL),
  ('cambridge', 'a2', 'misc', 'exit',         'noun', true,  false, NULL),
  ('cambridge', 'a2', 'misc', 'future',       'noun', false, false, NULL),
  ('cambridge', 'a2', 'misc', 'hour',         'noun', false, false, NULL),
  ('cambridge', 'a2', 'misc', 'information',  'noun', false, false, NULL),
  ('cambridge', 'a2', 'misc', 'job',          'noun', false, false, NULL),
  ('cambridge', 'a2', 'misc', 'kilometre',    'noun', false, false, 'US: kilometer'),
  ('cambridge', 'a2', 'misc', 'meeting',      'noun', false, false, NULL),
  ('cambridge', 'a2', 'misc', 'million',      'noun', false, false, NULL),
  ('cambridge', 'a2', 'misc', 'minute',       'noun', false, false, NULL),
  ('cambridge', 'a2', 'misc', 'money',        'noun', false, false, NULL),
  ('cambridge', 'a2', 'misc', 'month',        'noun', false, false, NULL),
  ('cambridge', 'a2', 'misc', 'news',         'noun', false, false, NULL),
  ('cambridge', 'a2', 'misc', 'newspaper',    'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'misc', 'north',        'noun', false, false, NULL),
  ('cambridge', 'a2', 'misc', 'postcard',     'noun', true,  true,  NULL),
  ('cambridge', 'a2', 'misc', 'quarter',      'noun', false, false, NULL),
  ('cambridge', 'a2', 'misc', 'second',       'noun', false, false, 'unit of time'),
  ('cambridge', 'a2', 'misc', 'south',        'noun', false, false, NULL),
  ('cambridge', 'a2', 'misc', 'surprise',     'noun', false, false, NULL),
  ('cambridge', 'a2', 'misc', 'surname',      'noun', false, false, NULL),
  ('cambridge', 'a2', 'misc', 'thousand',     'noun', false, false, NULL),
  ('cambridge', 'a2', 'misc', 'time',         'noun', false, false, NULL),
  ('cambridge', 'a2', 'misc', 'way',          'noun', false, false, NULL),
  ('cambridge', 'a2', 'misc', 'west',         'noun', false, false, NULL),
  ('cambridge', 'a2', 'misc', 'zero',         'noun', false, false, NULL)
ON CONFLICT DO NOTHING;
