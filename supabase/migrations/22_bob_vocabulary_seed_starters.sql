-- bob_vocabulary: shared wordlist table for every framework × CEFR level.
-- First seeded with the official Cambridge YLE Pre A1 Starters wordlist
-- (picture book 2018). Future migrations append Movers, Flyers, KET, etc.
--
-- The table is the single source of truth for "what words can appear in a
-- generated activity for this level". Server actions pre-pick N words from
-- here and pass them into the LLM prompt — the LLM no longer invents the
-- vocabulary, only writes scenes / cues for the given words. That removes
-- the "always apple / cat / book" few-shot anchoring problem.

CREATE TABLE IF NOT EXISTS public.bob_vocabulary (
  id          BIGSERIAL PRIMARY KEY,
  framework   TEXT NOT NULL,
  cefr_level  TEXT NOT NULL,
  exam_part   TEXT,
  category    TEXT NOT NULL,
  word        TEXT NOT NULL,
  word_type   TEXT NOT NULL DEFAULT 'noun',
  pointable   BOOLEAN NOT NULL DEFAULT TRUE,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bob_vocabulary_unique UNIQUE (framework, cefr_level, word)
);

CREATE INDEX IF NOT EXISTS idx_bob_vocab_pick
  ON public.bob_vocabulary (framework, cefr_level, category, pointable);

ALTER TABLE public.bob_vocabulary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bob_vocabulary_read_all" ON public.bob_vocabulary;
CREATE POLICY "bob_vocabulary_read_all"
  ON public.bob_vocabulary FOR SELECT
  USING (TRUE);

-- ---------------------------------------------------------------------------
-- Seed: Cambridge YLE Pre A1 Starters wordlist (picture book 2018).
-- Source: Referencias/396158-yle-starters-word-list-picture-book-2018.pdf (pp. 25-29).
-- Only pointable concrete nouns are included (suitable for "Point to the X"
-- and image generation). Abstract or function words are omitted on purpose.
-- ---------------------------------------------------------------------------

INSERT INTO public.bob_vocabulary (framework, cefr_level, exam_part, category, word, word_type, pointable, notes) VALUES
  ('cambridge', 'pre_a1', 'starters', 'animals', 'bear',        'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'animals', 'bee',         'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'animals', 'bird',        'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'animals', 'cat',         'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'animals', 'chicken',     'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'animals', 'cow',         'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'animals', 'crocodile',   'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'animals', 'dog',         'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'animals', 'donkey',      'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'animals', 'duck',        'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'animals', 'elephant',    'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'animals', 'fish',        'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'animals', 'frog',        'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'animals', 'giraffe',     'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'animals', 'goat',        'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'animals', 'hippo',       'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'animals', 'horse',       'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'animals', 'jellyfish',   'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'animals', 'lizard',      'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'animals', 'monkey',      'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'animals', 'mouse',       'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'animals', 'polar bear',  'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'animals', 'sheep',       'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'animals', 'snake',       'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'animals', 'spider',      'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'animals', 'tiger',       'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'animals', 'zebra',       'noun', TRUE, NULL),

  ('cambridge', 'pre_a1', 'starters', 'body', 'arm',   'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'body', 'ear',   'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'body', 'eye',   'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'body', 'face',  'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'body', 'foot',  'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'body', 'hair',  'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'body', 'hand',  'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'body', 'head',  'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'body', 'leg',   'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'body', 'mouth', 'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'body', 'nose',  'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'body', 'tail',  'noun', TRUE, NULL),

  ('cambridge', 'pre_a1', 'starters', 'clothes', 'baseball cap', 'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'clothes', 'boots',        'noun', TRUE, 'plural'),
  ('cambridge', 'pre_a1', 'starters', 'clothes', 'dress',        'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'clothes', 'handbag',      'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'clothes', 'hat',          'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'clothes', 'jacket',       'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'clothes', 'jeans',        'noun', TRUE, 'plural'),
  ('cambridge', 'pre_a1', 'starters', 'clothes', 'shirt',        'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'clothes', 'shoe',         'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'clothes', 'shorts',       'noun', TRUE, 'plural'),
  ('cambridge', 'pre_a1', 'starters', 'clothes', 'skirt',        'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'clothes', 'sock',         'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'clothes', 'T-shirt',      'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'clothes', 'trousers',     'noun', TRUE, 'plural'),

  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'apple',       'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'banana',      'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'bean',        'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'bread',       'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'burger',      'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'cake',        'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'candy',       'noun', TRUE, 'US; UK: sweet'),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'carrot',      'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'chocolate',   'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'coconut',     'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'egg',         'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'fruit',       'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'grape',       'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'ice cream',   'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'juice',       'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'kiwi',        'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'lemon',       'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'lemonade',    'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'lime',        'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'mango',       'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'meat',        'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'meatballs',   'noun', TRUE, 'plural'),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'milk',        'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'onion',       'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'orange',      'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'pea',         'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'pear',        'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'pie',         'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'pineapple',   'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'potato',      'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'rice',        'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'sausage',     'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'tomato',      'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'water',       'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'food_drink', 'watermelon',  'noun', TRUE, NULL),

  ('cambridge', 'pre_a1', 'starters', 'home', 'apartment', 'noun', TRUE, 'US; UK: flat'),
  ('cambridge', 'pre_a1', 'starters', 'home', 'armchair',  'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'home', 'bath',      'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'home', 'bed',       'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'home', 'bookcase',  'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'home', 'box',       'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'home', 'chair',     'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'home', 'clock',     'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'home', 'cupboard',  'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'home', 'desk',      'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'home', 'door',      'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'home', 'lamp',      'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'home', 'mat',       'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'home', 'mirror',    'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'home', 'rug',       'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'home', 'sofa',      'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'home', 'table',     'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'home', 'wall',      'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'home', 'window',    'noun', TRUE, NULL),

  ('cambridge', 'pre_a1', 'starters', 'school', 'board',    'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'school', 'book',     'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'school', 'computer', 'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'school', 'crayon',   'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'school', 'eraser',   'noun', TRUE, 'US; UK: rubber'),
  ('cambridge', 'pre_a1', 'starters', 'school', 'keyboard', 'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'school', 'pen',      'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'school', 'pencil',   'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'school', 'picture',  'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'school', 'poster',   'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'school', 'ruler',    'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'school', 'tablet',   'noun', TRUE, NULL),

  ('cambridge', 'pre_a1', 'starters', 'toys', 'ball',         'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'toys', 'balloon',      'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'toys', 'board game',   'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'toys', 'doll',         'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'toys', 'kite',         'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'toys', 'robot',        'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'toys', 'teddy bear',   'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'toys', 'toy',          'noun', TRUE, NULL),

  ('cambridge', 'pre_a1', 'starters', 'sports_music', 'bike',          'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'sports_music', 'camera',        'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'sports_music', 'guitar',        'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'sports_music', 'phone',         'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'sports_music', 'piano',         'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'sports_music', 'radio',         'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'sports_music', 'tennis racket', 'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'sports_music', 'television',    'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'sports_music', 'watch',         'noun', TRUE, NULL),

  ('cambridge', 'pre_a1', 'starters', 'transport', 'boat',       'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'transport', 'bus',        'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'transport', 'car',        'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'transport', 'helicopter', 'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'transport', 'lorry',      'noun', TRUE, 'UK; US: truck'),
  ('cambridge', 'pre_a1', 'starters', 'transport', 'motorbike',  'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'transport', 'plane',      'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'transport', 'ship',       'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'transport', 'skateboard', 'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'transport', 'train',      'noun', TRUE, NULL),

  ('cambridge', 'pre_a1', 'starters', 'nature', 'beach',  'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'nature', 'flower', 'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'nature', 'sand',   'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'nature', 'sea',    'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'nature', 'shell',  'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'nature', 'sun',    'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'nature', 'tree',   'noun', TRUE, NULL),

  ('cambridge', 'pre_a1', 'starters', 'people', 'baby',    'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'people', 'boy',     'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'people', 'girl',    'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'people', 'man',     'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'people', 'monster', 'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'people', 'alien',   'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'people', 'teacher', 'noun', TRUE, NULL),
  ('cambridge', 'pre_a1', 'starters', 'people', 'woman',   'noun', TRUE, NULL)
ON CONFLICT (framework, cefr_level, word) DO NOTHING;
