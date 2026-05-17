-- Migration 43: Seed B1 (Cambridge Preliminary) vocabulary
-- Strategy:
--   1. Copy all A2 rows → B1 (B1 is cumulative: A2 + new B1 words).
--   2. Insert new nouns that appear in the B1 list but NOT in A2.
--
-- Category mapping decisions:
--   entertainment  → new (Cambridge "Entertainment and Media" / "Hobbies and Leisure")
--   environment    → new (Cambridge "Environment")
--   feelings       → new (Cambridge "Personal Feelings, Opinions and Experiences")
--   language       → new (Cambridge "Language" topic)
--   social         → new (Cambridge "Social Interaction" / social concepts)
--   travel         → new (Cambridge "Travel and Transport" travel-specific)
--   weather        → new (Cambridge "Weather" topic, not nature)
--   work           → new (Cambridge "Work and Jobs")
--   places         → existing (buildings, town/city, services, shopping)
--   health         → existing (extended with B1 medical vocab)
--   home           → existing (extended with B1 household vocab)
--   school         → existing (Education topic)
--   tech           → existing (Communications and Technology)
--   clothes        → existing (Clothes and Accessories)
--   food_drink     → existing (Food and Drink)
--   sports_music   → existing (Sport + music/arts from Entertainment)
--   people         → existing (people/roles)
--   transport      → existing (vehicles/transport)
--   nature         → existing (natural world)
--   animals        → existing (natural world - animals)
--
-- pointable=true  → concrete nouns that can appear as objects in a picture
-- object_card_friendly=true → default except: body, people (generic), feelings,
--                             social, language, weather/environment concepts

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Copy A2 → B1 (cumulative)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.bob_vocabulary
  (framework, cefr_level, category, word, word_type, pointable, object_card_friendly, notes)
SELECT
  framework,
  'b1',
  category,
  word,
  word_type,
  pointable,
  object_card_friendly,
  notes
FROM public.bob_vocabulary
WHERE cefr_level = 'a2'
  AND framework  = 'cambridge'
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: New B1-only nouns (not present in A2)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── CLOTHES ──────────────────────────────────────────────────────────────────
INSERT INTO public.bob_vocabulary
  (framework, cefr_level, category, word, word_type, pointable, object_card_friendly)
VALUES
  ('cambridge','b1','clothes','blouse',      'noun', true,  true),
  ('cambridge','b1','clothes','button',      'noun', true,  true),
  ('cambridge','b1','clothes','chain',       'noun', true,  true),
  ('cambridge','b1','clothes','collar',      'noun', true,  true),
  ('cambridge','b1','clothes','cotton',      'noun', false, true),
  ('cambridge','b1','clothes','clothing',    'noun', false, true),
  ('cambridge','b1','clothes','earring',     'noun', true,  true),
  ('cambridge','b1','clothes','handkerchief','noun', true,  true),
  ('cambridge','b1','clothes','hoodie',      'noun', true,  true),
  ('cambridge','b1','clothes','jewellery',   'noun', false, true),
  ('cambridge','b1','clothes','jumper',      'noun', true,  true),
  ('cambridge','b1','clothes','kit',         'noun', false, true),
  ('cambridge','b1','clothes','label',       'noun', true,  true),
  ('cambridge','b1','clothes','leather',     'noun', false, true),
  ('cambridge','b1','clothes','material',    'noun', false, true),
  ('cambridge','b1','clothes','pullover',    'noun', true,  true),
  ('cambridge','b1','clothes','sandal',      'noun', true,  true),
  ('cambridge','b1','clothes','silk',        'noun', false, true),
  ('cambridge','b1','clothes','sleeve',      'noun', true,  true),
  ('cambridge','b1','clothes','sweatshirt',  'noun', true,  true),
  ('cambridge','b1','clothes','tracksuit',   'noun', true,  true),
  ('cambridge','b1','clothes','underpants',  'noun', true,  true),
  ('cambridge','b1','clothes','underwear',   'noun', false, true),
  ('cambridge','b1','clothes','wetsuit',     'noun', true,  true),
  ('cambridge','b1','clothes','wool',        'noun', false, true)
ON CONFLICT DO NOTHING;

-- ── ENTERTAINMENT (new category) ─────────────────────────────────────────────
INSERT INTO public.bob_vocabulary
  (framework, cefr_level, category, word, word_type, pointable, object_card_friendly)
VALUES
  ('cambridge','b1','entertainment','action',         'noun', false, false),
  ('cambridge','b1','entertainment','ad',             'noun', false, true),
  ('cambridge','b1','entertainment','advert',         'noun', false, true),
  ('cambridge','b1','entertainment','advertisement',  'noun', false, true),
  ('cambridge','b1','entertainment','audience',       'noun', false, false),
  ('cambridge','b1','entertainment','ballet',         'noun', false, true),
  ('cambridge','b1','entertainment','band',           'noun', false, false),
  ('cambridge','b1','entertainment','bestseller',     'noun', true,  true),
  ('cambridge','b1','entertainment','celebrity',      'noun', false, false),
  ('cambridge','b1','entertainment','chat show',      'noun', false, true),
  ('cambridge','b1','entertainment','circus',         'noun', false, true),
  ('cambridge','b1','entertainment','comedy',         'noun', false, true),
  ('cambridge','b1','entertainment','comic',          'noun', true,  true),
  ('cambridge','b1','entertainment','documentary',    'noun', false, true),
  ('cambridge','b1','entertainment','drama',          'noun', false, true),
  ('cambridge','b1','entertainment','episode',        'noun', false, false),
  ('cambridge','b1','entertainment','exhibition',     'noun', false, true),
  ('cambridge','b1','entertainment','fiction',        'noun', false, false),
  ('cambridge','b1','entertainment','folk music',     'noun', false, false),
  ('cambridge','b1','entertainment','gallery',        'noun', true,  true),
  ('cambridge','b1','entertainment','headphones',     'noun', true,  true),
  ('cambridge','b1','entertainment','hip hop',        'noun', false, false),
  ('cambridge','b1','entertainment','horror',         'noun', false, false),
  ('cambridge','b1','entertainment','humour',         'noun', false, false),
  ('cambridge','b1','entertainment','interval',       'noun', false, false),
  ('cambridge','b1','entertainment','jazz',           'noun', false, false),
  ('cambridge','b1','entertainment','microphone',     'noun', true,  true),
  ('cambridge','b1','entertainment','musical',        'noun', true,  true),
  ('cambridge','b1','entertainment','news',           'noun', false, false),
  ('cambridge','b1','entertainment','newspaper',      'noun', true,  true),
  ('cambridge','b1','entertainment','novel',          'noun', true,  true),
  ('cambridge','b1','entertainment','novelist',       'noun', false, false),
  ('cambridge','b1','entertainment','opera',          'noun', false, true),
  ('cambridge','b1','entertainment','orchestra',      'noun', false, true),
  ('cambridge','b1','entertainment','painting',       'noun', true,  true),
  ('cambridge','b1','entertainment','performer',      'noun', false, false),
  ('cambridge','b1','entertainment','plot',           'noun', false, false),
  ('cambridge','b1','entertainment','podcast',        'noun', false, true),
  ('cambridge','b1','entertainment','poem',           'noun', false, true),
  ('cambridge','b1','entertainment','poet',           'noun', false, false),
  ('cambridge','b1','entertainment','poetry',         'noun', false, false),
  ('cambridge','b1','entertainment','pop',            'noun', false, false),
  ('cambridge','b1','entertainment','presenter',      'noun', false, false),
  ('cambridge','b1','entertainment','production',     'noun', false, false),
  ('cambridge','b1','entertainment','rap',            'noun', false, false),
  ('cambridge','b1','entertainment','recording',      'noun', false, false),
  ('cambridge','b1','entertainment','review',         'noun', false, false),
  ('cambridge','b1','entertainment','romance',        'noun', false, false),
  ('cambridge','b1','entertainment','scene',          'noun', false, false),
  ('cambridge','b1','entertainment','sculpture',      'noun', true,  true),
  ('cambridge','b1','entertainment','selfie',         'noun', true,  true),
  ('cambridge','b1','entertainment','series',         'noun', false, false),
  ('cambridge','b1','entertainment','soap opera',     'noun', false, false),
  ('cambridge','b1','entertainment','soundtrack',     'noun', false, false),
  ('cambridge','b1','entertainment','thriller',       'noun', true,  true),
  ('cambridge','b1','entertainment','video clip',     'noun', false, true)
ON CONFLICT DO NOTHING;

-- ── ENVIRONMENT (new category) ────────────────────────────────────────────────
INSERT INTO public.bob_vocabulary
  (framework, cefr_level, category, word, word_type, pointable, object_card_friendly)
VALUES
  ('cambridge','b1','environment','bottle bank',    'noun', true,  true),
  ('cambridge','b1','environment','climate',        'noun', false, false),
  ('cambridge','b1','environment','climate change', 'noun', false, false),
  ('cambridge','b1','environment','litter',         'noun', false, false),
  ('cambridge','b1','environment','pollution',      'noun', false, false),
  ('cambridge','b1','environment','recycling',      'noun', false, false),
  ('cambridge','b1','environment','rubbish bin',    'noun', true,  true),
  ('cambridge','b1','environment','species',        'noun', false, false),
  ('cambridge','b1','environment','wildlife',       'noun', false, false)
ON CONFLICT DO NOTHING;

-- ── FEELINGS (new category) ──────────────────────────────────────────────────
-- Only concrete-ish nouns; most are adjectives (already excluded)
INSERT INTO public.bob_vocabulary
  (framework, cefr_level, category, word, word_type, pointable, object_card_friendly)
VALUES
  ('cambridge','b1','feelings','ambition',     'noun', false, false),
  ('cambridge','b1','feelings','anger',        'noun', false, false),
  ('cambridge','b1','feelings','attitude',     'noun', false, false),
  ('cambridge','b1','feelings','behaviour',    'noun', false, false),
  ('cambridge','b1','feelings','childhood',    'noun', false, false),
  ('cambridge','b1','feelings','confidence',   'noun', false, false),
  ('cambridge','b1','feelings','courage',      'noun', false, false),
  ('cambridge','b1','feelings','dream',        'noun', false, false),
  ('cambridge','b1','feelings','emotion',      'noun', false, false),
  ('cambridge','b1','feelings','excitement',   'noun', false, false),
  ('cambridge','b1','feelings','experience',   'noun', false, false),
  ('cambridge','b1','feelings','fear',         'noun', false, false),
  ('cambridge','b1','feelings','feeling',      'noun', false, false),
  ('cambridge','b1','feelings','friendship',   'noun', false, false),
  ('cambridge','b1','feelings','happiness',    'noun', false, false),
  ('cambridge','b1','feelings','hope',         'noun', false, false),
  ('cambridge','b1','feelings','humour',       'noun', false, false),
  ('cambridge','b1','feelings','imagination',  'noun', false, false),
  ('cambridge','b1','feelings','importance',   'noun', false, false),
  ('cambridge','b1','feelings','memory',       'noun', false, false),
  ('cambridge','b1','feelings','mind',         'noun', false, false),
  ('cambridge','b1','feelings','mood',         'noun', false, false),
  ('cambridge','b1','feelings','opinion',      'noun', false, false),
  ('cambridge','b1','feelings','pleasure',     'noun', false, false),
  ('cambridge','b1','feelings','pity',         'noun', false, false),
  ('cambridge','b1','feelings','pride',        'noun', false, false),
  ('cambridge','b1','feelings','regret',       'noun', false, false),
  ('cambridge','b1','feelings','relaxation',   'noun', false, false),
  ('cambridge','b1','feelings','respect',      'noun', false, false),
  ('cambridge','b1','feelings','romance',      'noun', false, false),
  ('cambridge','b1','feelings','shame',        'noun', false, false),
  ('cambridge','b1','feelings','stress',       'noun', false, false),
  ('cambridge','b1','feelings','talent',       'noun', false, false),
  ('cambridge','b1','feelings','thought',      'noun', false, false),
  ('cambridge','b1','feelings','trust',        'noun', false, false),
  ('cambridge','b1','feelings','wonder',       'noun', false, false)
ON CONFLICT DO NOTHING;

-- ── FOOD & DRINK (new B1 additions) ──────────────────────────────────────────
INSERT INTO public.bob_vocabulary
  (framework, cefr_level, category, word, word_type, pointable, object_card_friendly)
VALUES
  ('cambridge','b1','food_drink','broccoli',     'noun', true,  true),
  ('cambridge','b1','food_drink','cabbage',      'noun', true,  true),
  ('cambridge','b1','food_drink','canteen',      'noun', true,  true),
  ('cambridge','b1','food_drink','chef',         'noun', false, false),
  ('cambridge','b1','food_drink','cookery',      'noun', false, false),
  ('cambridge','b1','food_drink','cookie',       'noun', true,  true),
  ('cambridge','b1','food_drink','corn',         'noun', true,  true),
  ('cambridge','b1','food_drink','diet',         'noun', false, false),
  ('cambridge','b1','food_drink','duck',         'noun', true,  true),
  ('cambridge','b1','food_drink','flavour',      'noun', false, false),
  ('cambridge','b1','food_drink','French fries', 'noun', true,  true),
  ('cambridge','b1','food_drink','frying pan',   'noun', true,  true),
  ('cambridge','b1','food_drink','herb',         'noun', true,  true),
  ('cambridge','b1','food_drink','ingredient',   'noun', false, false),
  ('cambridge','b1','food_drink','jug',          'noun', true,  true),
  ('cambridge','b1','food_drink','kettle',       'noun', true,  true),
  ('cambridge','b1','food_drink','lamb',         'noun', true,  true),
  ('cambridge','b1','food_drink','lettuce',      'noun', true,  true),
  ('cambridge','b1','food_drink','microwave',    'noun', true,  true),
  ('cambridge','b1','food_drink','olive',        'noun', true,  true),
  ('cambridge','b1','food_drink','pan',          'noun', true,  true),
  ('cambridge','b1','food_drink','peach',        'noun', true,  true),
  ('cambridge','b1','food_drink','peanut',       'noun', true,  true),
  ('cambridge','b1','food_drink','recipe',       'noun', false, true),
  ('cambridge','b1','food_drink','refreshments', 'noun', false, false),
  ('cambridge','b1','food_drink','roll',         'noun', true,  true),
  ('cambridge','b1','food_drink','salmon',       'noun', true,  true),
  ('cambridge','b1','food_drink','saucepan',     'noun', true,  true),
  ('cambridge','b1','food_drink','saucer',       'noun', true,  true),
  ('cambridge','b1','food_drink','soft drink',   'noun', true,  true),
  ('cambridge','b1','food_drink','spinach',      'noun', true,  true),
  ('cambridge','b1','food_drink','takeaway',     'noun', true,  true),
  ('cambridge','b1','food_drink','tin',          'noun', true,  true),
  ('cambridge','b1','food_drink','tuna',         'noun', true,  true),
  ('cambridge','b1','food_drink','turkey',       'noun', true,  true),
  ('cambridge','b1','food_drink','vanilla',      'noun', true,  true)
ON CONFLICT DO NOTHING;

-- ── HEALTH (new B1 additions) ─────────────────────────────────────────────────
INSERT INTO public.bob_vocabulary
  (framework, cefr_level, category, word, word_type, pointable, object_card_friendly)
VALUES
  ('cambridge','b1','health','ache',          'noun', false, false),
  ('cambridge','b1','health','ankle',         'noun', true,  false),
  ('cambridge','b1','health','aspirin',       'noun', true,  true),
  ('cambridge','b1','health','breath',        'noun', false, false),
  ('cambridge','b1','health','chin',          'noun', true,  false),
  ('cambridge','b1','health','damage',        'noun', false, false),
  ('cambridge','b1','health','death',         'noun', false, false),
  ('cambridge','b1','health','diet',          'noun', false, false),
  ('cambridge','b1','health','disease',       'noun', false, false),
  ('cambridge','b1','health','emergency',     'noun', false, false),
  ('cambridge','b1','health','fever',         'noun', false, false),
  ('cambridge','b1','health','fitness',       'noun', false, false),
  ('cambridge','b1','health','flu',           'noun', false, false),
  ('cambridge','b1','health','gym',           'noun', true,  true),
  ('cambridge','b1','health','heel',          'noun', true,  false),
  ('cambridge','b1','health','illness',       'noun', false, false),
  ('cambridge','b1','health','lip',           'noun', true,  false),
  ('cambridge','b1','health','operation',     'noun', false, false),
  ('cambridge','b1','health','pharmacy',      'noun', true,  true),
  ('cambridge','b1','health','pill',          'noun', true,  true),
  ('cambridge','b1','health','prescription',  'noun', false, true),
  ('cambridge','b1','health','skin',          'noun', false, false),
  ('cambridge','b1','health','sore throat',   'noun', false, false),
  ('cambridge','b1','health','stress',        'noun', false, false),
  ('cambridge','b1','health','thumb',         'noun', true,  false)
ON CONFLICT DO NOTHING;

-- ── HOME (new B1 additions) ───────────────────────────────────────────────────
INSERT INTO public.bob_vocabulary
  (framework, cefr_level, category, word, word_type, pointable, object_card_friendly)
VALUES
  ('cambridge','b1','home','accommodation', 'noun', false, false),
  ('cambridge','b1','home','air conditioning','noun',true, true),
  ('cambridge','b1','home','alarm',         'noun', true,  true),
  ('cambridge','b1','home','balcony',       'noun', true,  true),
  ('cambridge','b1','home','basin',         'noun', true,  true),
  ('cambridge','b1','home','bathroom',      'noun', true,  true),
  ('cambridge','b1','home','bathtub',       'noun', true,  true),
  ('cambridge','b1','home','bell',          'noun', true,  true),
  ('cambridge','b1','home','blind',         'noun', true,  true),
  ('cambridge','b1','home','bookshelf',     'noun', true,  true),
  ('cambridge','b1','home','bucket',        'noun', true,  true),
  ('cambridge','b1','home','bulb',          'noun', true,  true),
  ('cambridge','b1','home','candle',        'noun', true,  true),
  ('cambridge','b1','home','carpet',        'noun', true,  true),
  ('cambridge','b1','home','ceiling',       'noun', true,  true),
  ('cambridge','b1','home','cellar',        'noun', true,  true),
  ('cambridge','b1','home','central heating','noun',false, false),
  ('cambridge','b1','home','chest of drawers','noun',true, true),
  ('cambridge','b1','home','cottage',       'noun', true,  true),
  ('cambridge','b1','home','dining room',   'noun', true,  true),
  ('cambridge','b1','home','dishwasher',    'noun', true,  true),
  ('cambridge','b1','home','duvet',         'noun', true,  true),
  ('cambridge','b1','home','fan',           'noun', true,  true),
  ('cambridge','b1','home','flat',          'noun', true,  true),
  ('cambridge','b1','home','flatmate',      'noun', false, false),
  ('cambridge','b1','home','freezer',       'noun', true,  true),
  ('cambridge','b1','home','hall',          'noun', true,  true),
  ('cambridge','b1','home','handle',        'noun', true,  true),
  ('cambridge','b1','home','heater',        'noun', true,  true),
  ('cambridge','b1','home','jug',           'noun', true,  true),
  ('cambridge','b1','home','kettle',        'noun', true,  true),
  ('cambridge','b1','home','ladder',        'noun', true,  true),
  ('cambridge','b1','home','lock',          'noun', true,  true),
  ('cambridge','b1','home','locker',        'noun', true,  true),
  ('cambridge','b1','home','mug',           'noun', true,  true),
  ('cambridge','b1','home','pan',           'noun', true,  true),
  ('cambridge','b1','home','pipe',          'noun', true,  true),
  ('cambridge','b1','home','plant',         'noun', true,  true),
  ('cambridge','b1','home','plug',          'noun', true,  true),
  ('cambridge','b1','home','property',      'noun', false, false),
  ('cambridge','b1','home','remote control','noun', true,  true),
  ('cambridge','b1','home','roommate',      'noun', false, false),
  ('cambridge','b1','home','safe',          'noun', true,  true),
  ('cambridge','b1','home','sheet',         'noun', true,  true),
  ('cambridge','b1','home','sitting room',  'noun', true,  true),
  ('cambridge','b1','home','stairs',        'noun', true,  true),
  ('cambridge','b1','home','switch',        'noun', true,  true),
  ('cambridge','b1','home','tap',           'noun', true,  true),
  ('cambridge','b1','home','vase',          'noun', true,  true),
  ('cambridge','b1','home','wardrobe',      'noun', true,  true)
ON CONFLICT DO NOTHING;

-- ── LANGUAGE (new category) ───────────────────────────────────────────────────
INSERT INTO public.bob_vocabulary
  (framework, cefr_level, category, word, word_type, pointable, object_card_friendly)
VALUES
  ('cambridge','b1','language','alphabet',      'noun', false, false),
  ('cambridge','b1','language','comma',         'noun', false, false),
  ('cambridge','b1','language','consonant',     'noun', false, false),
  ('cambridge','b1','language','correction',    'noun', false, false),
  ('cambridge','b1','language','essay',         'noun', false, true),
  ('cambridge','b1','language','grammar',       'noun', false, false),
  ('cambridge','b1','language','handwriting',   'noun', false, false),
  ('cambridge','b1','language','joke',          'noun', false, false),
  ('cambridge','b1','language','meaning',       'noun', false, false),
  ('cambridge','b1','language','paragraph',     'noun', false, false),
  ('cambridge','b1','language','phrase',        'noun', false, false),
  ('cambridge','b1','language','pronunciation', 'noun', false, false),
  ('cambridge','b1','language','sentence',      'noun', false, false),
  ('cambridge','b1','language','spelling',      'noun', false, false),
  ('cambridge','b1','language','translation',   'noun', false, false),
  ('cambridge','b1','language','vocabulary',    'noun', false, false),
  ('cambridge','b1','language','vowel',         'noun', false, false)
ON CONFLICT DO NOTHING;

-- ── NATURE (new B1 additions) ─────────────────────────────────────────────────
INSERT INTO public.bob_vocabulary
  (framework, cefr_level, category, word, word_type, pointable, object_card_friendly)
VALUES
  ('cambridge','b1','nature','bay',         'noun', true,  true),
  ('cambridge','b1','nature','branch',      'noun', true,  true),
  ('cambridge','b1','nature','bush',        'noun', true,  true),
  ('cambridge','b1','nature','cliff',       'noun', true,  true),
  ('cambridge','b1','nature','coast',       'noun', true,  true),
  ('cambridge','b1','nature','continent',   'noun', true,  true),
  ('cambridge','b1','nature','farmland',    'noun', false, true),
  ('cambridge','b1','nature','flood',       'noun', true,  true),
  ('cambridge','b1','nature','harbour',     'noun', true,  true),
  ('cambridge','b1','nature','jungle',      'noun', true,  true),
  ('cambridge','b1','nature','landscape',   'noun', true,  true),
  ('cambridge','b1','nature','lion',        'noun', true,  true),
  ('cambridge','b1','nature','mosquito',    'noun', true,  true),
  ('cambridge','b1','nature','port',        'noun', true,  true),
  ('cambridge','b1','nature','rainforest',  'noun', true,  true),
  ('cambridge','b1','nature','range',       'noun', true,  true),
  ('cambridge','b1','nature','scenery',     'noun', false, true),
  ('cambridge','b1','nature','sunrise',     'noun', true,  true),
  ('cambridge','b1','nature','sunset',      'noun', true,  true),
  ('cambridge','b1','nature','sunshine',    'noun', false, false),
  ('cambridge','b1','nature','valley',      'noun', true,  true),
  ('cambridge','b1','nature','waves',       'noun', true,  true)
ON CONFLICT DO NOTHING;

-- ── ANIMALS (new B1 additions) ────────────────────────────────────────────────
INSERT INTO public.bob_vocabulary
  (framework, cefr_level, category, word, word_type, pointable, object_card_friendly)
VALUES
  ('cambridge','b1','animals','bull',      'noun', true, true),
  ('cambridge','b1','animals','calf',      'noun', true, true),
  ('cambridge','b1','animals','cattle',    'noun', true, true),
  ('cambridge','b1','animals','dolphin',   'noun', true, true),
  ('cambridge','b1','animals','kitten',    'noun', true, true),
  ('cambridge','b1','animals','puppy',     'noun', true, true),
  ('cambridge','b1','animals','swan',      'noun', true, true)
ON CONFLICT DO NOTHING;

-- ── PEOPLE (new B1 additions) ─────────────────────────────────────────────────
INSERT INTO public.bob_vocabulary
  (framework, cefr_level, category, word, word_type, pointable, object_card_friendly)
VALUES
  ('cambridge','b1','people','architect',    'noun', false, false),
  ('cambridge','b1','people','athlete',      'noun', false, false),
  ('cambridge','b1','people','author',       'noun', false, false),
  ('cambridge','b1','people','babysitter',   'noun', false, false),
  ('cambridge','b1','people','baker',        'noun', false, false),
  ('cambridge','b1','people','banker',       'noun', false, false),
  ('cambridge','b1','people','barber',       'noun', false, false),
  ('cambridge','b1','people','beginner',     'noun', false, false),
  ('cambridge','b1','people','blogger',      'noun', false, false),
  ('cambridge','b1','people','boss',         'noun', false, false),
  ('cambridge','b1','people','butcher',      'noun', false, false),
  ('cambridge','b1','people','candidate',    'noun', false, false),
  ('cambridge','b1','people','captain',      'noun', false, false),
  ('cambridge','b1','people','celebrity',    'noun', false, false),
  ('cambridge','b1','people','chef',         'noun', false, false),
  ('cambridge','b1','people','cleaner',      'noun', false, false),
  ('cambridge','b1','people','colleague',    'noun', false, false),
  ('cambridge','b1','people','competitor',   'noun', false, false),
  ('cambridge','b1','people','crew',         'noun', false, false),
  ('cambridge','b1','people','criminal',     'noun', false, false),
  ('cambridge','b1','people','customs officer','noun',false,false),
  ('cambridge','b1','people','dancer',       'noun', false, false),
  ('cambridge','b1','people','detective',    'noun', false, false),
  ('cambridge','b1','people','director',     'noun', false, false),
  ('cambridge','b1','people','diver',        'noun', false, false),
  ('cambridge','b1','people','employee',     'noun', false, false),
  ('cambridge','b1','people','employer',     'noun', false, false),
  ('cambridge','b1','people','enemy',        'noun', false, false),
  ('cambridge','b1','people','film star',    'noun', false, false),
  ('cambridge','b1','people','foreigner',    'noun', false, false),
  ('cambridge','b1','people','footballer',   'noun', false, false),
  ('cambridge','b1','people','goalkeeper',   'noun', false, false),
  ('cambridge','b1','people','graduate',     'noun', false, false),
  ('cambridge','b1','people','guard',        'noun', false, false),
  ('cambridge','b1','people','guitarist',    'noun', false, false),
  ('cambridge','b1','people','hairdresser',  'noun', false, false),
  ('cambridge','b1','people','hero',         'noun', false, false),
  ('cambridge','b1','people','heroine',      'noun', false, false),
  ('cambridge','b1','people','housewife',    'noun', false, false),
  ('cambridge','b1','people','instructor',   'noun', false, false),
  ('cambridge','b1','people','interviewer',  'noun', false, false),
  ('cambridge','b1','people','judge',        'noun', false, false),
  ('cambridge','b1','people','lawyer',       'noun', false, false),
  ('cambridge','b1','people','lecturer',     'noun', false, false),
  ('cambridge','b1','people','librarian',    'noun', false, false),
  ('cambridge','b1','people','model',        'noun', false, false),
  ('cambridge','b1','people','nephew',       'noun', false, false),
  ('cambridge','b1','people','niece',        'noun', false, false),
  ('cambridge','b1','people','novelist',     'noun', false, false),
  ('cambridge','b1','people','officer',      'noun', false, false),
  ('cambridge','b1','people','operator',     'noun', false, false),
  ('cambridge','b1','people','owner',        'noun', false, false),
  ('cambridge','b1','people','painter',      'noun', false, false),
  ('cambridge','b1','people','pedestrian',   'noun', false, false),
  ('cambridge','b1','people','penfriend',    'noun', false, false),
  ('cambridge','b1','people','politician',   'noun', false, false),
  ('cambridge','b1','people','postman',      'noun', false, false),
  ('cambridge','b1','people','president',    'noun', false, false),
  ('cambridge','b1','people','prince',       'noun', false, false),
  ('cambridge','b1','people','princess',     'noun', false, false),
  ('cambridge','b1','people','prisoner',     'noun', false, false),
  ('cambridge','b1','people','professor',    'noun', false, false),
  ('cambridge','b1','people','programmer',   'noun', false, false),
  ('cambridge','b1','people','publisher',    'noun', false, false),
  ('cambridge','b1','people','pupil',        'noun', false, false),
  ('cambridge','b1','people','reporter',     'noun', false, false),
  ('cambridge','b1','people','rider',        'noun', false, false),
  ('cambridge','b1','people','runner',       'noun', false, false),
  ('cambridge','b1','people','sailor',       'noun', false, false),
  ('cambridge','b1','people','salesman',     'noun', false, false),
  ('cambridge','b1','people','saleswoman',   'noun', false, false),
  ('cambridge','b1','people','scientist',    'noun', false, false),
  ('cambridge','b1','people','security guard','noun', false, false),
  ('cambridge','b1','people','shop assistant','noun', false, false),
  ('cambridge','b1','people','shopper',      'noun', false, false),
  ('cambridge','b1','people','soldier',      'noun', false, false),
  ('cambridge','b1','people','spy',          'noun', false, false),
  ('cambridge','b1','people','staff',        'noun', false, false),
  ('cambridge','b1','people','stranger',     'noun', false, false),
  ('cambridge','b1','people','supporter',    'noun', false, false),
  ('cambridge','b1','people','taxi driver',  'noun', false, false),
  ('cambridge','b1','people','tourist',      'noun', false, false),
  ('cambridge','b1','people','tour guide',   'noun', false, false),
  ('cambridge','b1','people','twin',         'noun', false, false),
  ('cambridge','b1','people','user',         'noun', false, false),
  ('cambridge','b1','people','vet',          'noun', false, false),
  ('cambridge','b1','people','visitor',      'noun', false, false),
  ('cambridge','b1','people','volunteer',    'noun', false, false),
  ('cambridge','b1','people','youth',        'noun', false, false)
ON CONFLICT DO NOTHING;

-- ── PLACES (new B1 additions) ─────────────────────────────────────────────────
INSERT INTO public.bob_vocabulary
  (framework, cefr_level, category, word, word_type, pointable, object_card_friendly)
VALUES
  ('cambridge','b1','places','apartment block',   'noun', true,  true),
  ('cambridge','b1','places','booking office',     'noun', true,  true),
  ('cambridge','b1','places','bookshop',           'noun', true,  true),
  ('cambridge','b1','places','cafeteria',          'noun', true,  true),
  ('cambridge','b1','places','campsite',           'noun', true,  true),
  ('cambridge','b1','places','canal',              'noun', true,  true),
  ('cambridge','b1','places','capital city',       'noun', true,  true),
  ('cambridge','b1','places','cashpoint',          'noun', true,  true),
  ('cambridge','b1','places','cash machine',       'noun', true,  true),
  ('cambridge','b1','places','cathedral',          'noun', true,  true),
  ('cambridge','b1','places','city centre',        'noun', true,  true),
  ('cambridge','b1','places','clinic',             'noun', true,  true),
  ('cambridge','b1','places','crossroads',         'noun', true,  true),
  ('cambridge','b1','places','crossing',           'noun', true,  true),
  ('cambridge','b1','places','department store',   'noun', true,  true),
  ('cambridge','b1','places','district',           'noun', false, true),
  ('cambridge','b1','places','embassy',            'noun', true,  true),
  ('cambridge','b1','places','exit',               'noun', true,  true),
  ('cambridge','b1','places','flat',               'noun', true,  true),
  ('cambridge','b1','places','fountain',           'noun', true,  true),
  ('cambridge','b1','places','gallery',            'noun', true,  true),
  ('cambridge','b1','places','guest-house',        'noun', true,  true),
  ('cambridge','b1','places','hostel',             'noun', true,  true),
  ('cambridge','b1','places','mall',               'noun', true,  true),
  ('cambridge','b1','places','monument',           'noun', true,  true),
  ('cambridge','b1','places','neighbourhood',      'noun', false, true),
  ('cambridge','b1','places','nightclub',          'noun', true,  true),
  ('cambridge','b1','places','palace',             'noun', true,  true),
  ('cambridge','b1','places','pavement',           'noun', true,  true),
  ('cambridge','b1','places','prison',             'noun', true,  true),
  ('cambridge','b1','places','roundabout',         'noun', true,  true),
  ('cambridge','b1','places','ruin',               'noun', true,  true),
  ('cambridge','b1','places','shopping centre',    'noun', true,  true),
  ('cambridge','b1','places','signpost',           'noun', true,  true),
  ('cambridge','b1','places','square',             'noun', true,  true),
  ('cambridge','b1','places','stall',              'noun', true,  true),
  ('cambridge','b1','places','tower',              'noun', true,  true),
  ('cambridge','b1','places','tunnel',             'noun', true,  true),
  ('cambridge','b1','places','underground',        'noun', true,  true),
  ('cambridge','b1','places','zoo',                'noun', true,  true)
ON CONFLICT DO NOTHING;

-- ── SCHOOL / EDUCATION (new B1 additions) ────────────────────────────────────
INSERT INTO public.bob_vocabulary
  (framework, cefr_level, category, word, word_type, pointable, object_card_friendly)
VALUES
  ('cambridge','b1','school','arithmetic',      'noun', false, false),
  ('cambridge','b1','school','art',             'noun', false, false),
  ('cambridge','b1','school','beginner',        'noun', false, false),
  ('cambridge','b1','school','break',           'noun', false, false),
  ('cambridge','b1','school','certificate',     'noun', false, true),
  ('cambridge','b1','school','coach',           'noun', false, false),
  ('cambridge','b1','school','composition',     'noun', false, false),
  ('cambridge','b1','school','course',          'noun', false, false),
  ('cambridge','b1','school','curriculum',      'noun', false, false),
  ('cambridge','b1','school','degree',          'noun', false, false),
  ('cambridge','b1','school','diploma',         'noun', false, true),
  ('cambridge','b1','school','drama',           'noun', false, false),
  ('cambridge','b1','school','economics',       'noun', false, false),
  ('cambridge','b1','school','essay',           'noun', false, true),
  ('cambridge','b1','school','information',     'noun', false, false),
  ('cambridge','b1','school','instructor',      'noun', false, false),
  ('cambridge','b1','school','intermediate',    'noun', false, false),
  ('cambridge','b1','school','IT',              'noun', false, false),
  ('cambridge','b1','school','laboratory',      'noun', true,  true),
  ('cambridge','b1','school','lecture',         'noun', false, false),
  ('cambridge','b1','school','lecturer',        'noun', false, false),
  ('cambridge','b1','school','level',           'noun', false, false),
  ('cambridge','b1','school','mark',            'noun', false, false),
  ('cambridge','b1','school','mathematics',     'noun', false, false),
  ('cambridge','b1','school','nature studies',  'noun', false, false),
  ('cambridge','b1','school','noticeboard',     'noun', true,  true),
  ('cambridge','b1','school','pencil case',     'noun', true,  true),
  ('cambridge','b1','school','practice',        'noun', false, false),
  ('cambridge','b1','school','primary school',  'noun', true,  true),
  ('cambridge','b1','school','qualification',   'noun', false, false),
  ('cambridge','b1','school','research',        'noun', false, false),
  ('cambridge','b1','school','revision',        'noun', false, false),
  ('cambridge','b1','school','rubber',          'noun', true,  true),
  ('cambridge','b1','school','secondary school','noun', true,  true),
  ('cambridge','b1','school','term',            'noun', false, false),
  ('cambridge','b1','school','textbook',        'noun', true,  true),
  ('cambridge','b1','school','training',        'noun', false, false)
ON CONFLICT DO NOTHING;

-- ── SOCIAL (new category) ────────────────────────────────────────────────────
INSERT INTO public.bob_vocabulary
  (framework, cefr_level, category, word, word_type, pointable, object_card_friendly)
VALUES
  ('cambridge','b1','social','anniversary',  'noun', false, false),
  ('cambridge','b1','social','apology',      'noun', false, false),
  ('cambridge','b1','social','appointment',  'noun', false, false),
  ('cambridge','b1','social','argument',     'noun', false, false),
  ('cambridge','b1','social','benefit',      'noun', false, false),
  ('cambridge','b1','social','celebration',  'noun', false, false),
  ('cambridge','b1','social','charity',      'noun', false, false),
  ('cambridge','b1','social','complaint',    'noun', false, false),
  ('cambridge','b1','social','custom',       'noun', false, false),
  ('cambridge','b1','social','excuse',       'noun', false, false),
  ('cambridge','b1','social','greeting',     'noun', false, false),
  ('cambridge','b1','social','honeymoon',    'noun', false, false),
  ('cambridge','b1','social','invitation',   'noun', false, true),
  ('cambridge','b1','social','marriage',     'noun', false, false),
  ('cambridge','b1','social','occasion',     'noun', false, false),
  ('cambridge','b1','social','permission',   'noun', false, false),
  ('cambridge','b1','social','relationship', 'noun', false, false),
  ('cambridge','b1','social','religion',     'noun', false, false),
  ('cambridge','b1','social','tradition',    'noun', false, false),
  ('cambridge','b1','social','wedding',      'noun', false, true)
ON CONFLICT DO NOTHING;

-- ── SPORTS & MUSIC (new B1 additions) ────────────────────────────────────────
INSERT INTO public.bob_vocabulary
  (framework, cefr_level, category, word, word_type, pointable, object_card_friendly)
VALUES
  ('cambridge','b1','sports_music','athletics',     'noun', false, true),
  ('cambridge','b1','sports_music','badminton',     'noun', false, true),
  ('cambridge','b1','sports_music','baseball',      'noun', false, true),
  ('cambridge','b1','sports_music','basketball',    'noun', true,  true),
  ('cambridge','b1','sports_music','bat',           'noun', true,  true),
  ('cambridge','b1','sports_music','boxing',        'noun', false, true),
  ('cambridge','b1','sports_music','champion',      'noun', false, false),
  ('cambridge','b1','sports_music','championship',  'noun', false, false),
  ('cambridge','b1','sports_music','changing room', 'noun', true,  true),
  ('cambridge','b1','sports_music','contest',       'noun', false, false),
  ('cambridge','b1','sports_music','court',         'noun', true,  true),
  ('cambridge','b1','sports_music','cricket',       'noun', false, true),
  ('cambridge','b1','sports_music','cruise',        'noun', false, true),
  ('cambridge','b1','sports_music','cyclist',       'noun', false, false),
  ('cambridge','b1','sports_music','diving',        'noun', false, true),
  ('cambridge','b1','sports_music','extreme sport', 'noun', false, false),
  ('cambridge','b1','sports_music','fishing',       'noun', false, true),
  ('cambridge','b1','sports_music','flute',         'noun', true,  true),
  ('cambridge','b1','sports_music','football player','noun', false, false),
  ('cambridge','b1','sports_music','gymnastics',    'noun', false, true),
  ('cambridge','b1','sports_music','hockey',        'noun', false, true),
  ('cambridge','b1','sports_music','horse-riding',  'noun', false, true),
  ('cambridge','b1','sports_music','ice hockey',    'noun', false, true),
  ('cambridge','b1','sports_music','ice skates',    'noun', true,  true),
  ('cambridge','b1','sports_music','ice skating',   'noun', false, true),
  ('cambridge','b1','sports_music','jogging',       'noun', false, false),
  ('cambridge','b1','sports_music','league',        'noun', false, false),
  ('cambridge','b1','sports_music','locker',        'noun', true,  true),
  ('cambridge','b1','sports_music','long jump',     'noun', false, true),
  ('cambridge','b1','sports_music','motor-racing',  'noun', false, true),
  ('cambridge','b1','sports_music','net',           'noun', true,  true),
  ('cambridge','b1','sports_music','pitch',         'noun', true,  true),
  ('cambridge','b1','sports_music','player',        'noun', false, false),
  ('cambridge','b1','sports_music','rugby',         'noun', false, true),
  ('cambridge','b1','sports_music','sailing',       'noun', false, true),
  ('cambridge','b1','sports_music','skateboarding', 'noun', false, true),
  ('cambridge','b1','sports_music','skating',       'noun', false, true),
  ('cambridge','b1','sports_music','skiing',        'noun', false, true),
  ('cambridge','b1','sports_music','soccer',        'noun', false, true),
  ('cambridge','b1','sports_music','squash',        'noun', false, true),
  ('cambridge','b1','sports_music','surfboard',     'noun', true,  true),
  ('cambridge','b1','sports_music','surfing',       'noun', false, true),
  ('cambridge','b1','sports_music','table tennis',  'noun', false, true),
  ('cambridge','b1','sports_music','tennis player', 'noun', false, false),
  ('cambridge','b1','sports_music','tracksuit',     'noun', true,  true),
  ('cambridge','b1','sports_music','trainer',       'noun', false, false),
  ('cambridge','b1','sports_music','trumpet',       'noun', true,  true),
  ('cambridge','b1','sports_music','volleyball',    'noun', true,  true),
  ('cambridge','b1','sports_music','water skiing',  'noun', false, true),
  ('cambridge','b1','sports_music','windsurfing',   'noun', false, true),
  ('cambridge','b1','sports_music','workout',       'noun', false, false),
  ('cambridge','b1','sports_music','yoga',          'noun', false, true)
ON CONFLICT DO NOTHING;

-- ── TECH (new B1 additions) ───────────────────────────────────────────────────
INSERT INTO public.bob_vocabulary
  (framework, cefr_level, category, word, word_type, pointable, object_card_friendly)
VALUES
  ('cambridge','b1','tech','battery',      'noun', true,  true),
  ('cambridge','b1','tech','blog',         'noun', false, false),
  ('cambridge','b1','tech','blogger',      'noun', false, false),
  ('cambridge','b1','tech','cable',        'noun', true,  true),
  ('cambridge','b1','tech','digital camera','noun',true,  true),
  ('cambridge','b1','tech','download',     'noun', false, false),
  ('cambridge','b1','tech','folder',       'noun', true,  true),
  ('cambridge','b1','tech','hardware',     'noun', false, false),
  ('cambridge','b1','tech','homepage',     'noun', false, false),
  ('cambridge','b1','tech','IT',           'noun', false, false),
  ('cambridge','b1','tech','microphone',   'noun', true,  true),
  ('cambridge','b1','tech','mouse mat',    'noun', true,  true),
  ('cambridge','b1','tech','network',      'noun', false, false),
  ('cambridge','b1','tech','PC',           'noun', true,  true),
  ('cambridge','b1','tech','podcast',      'noun', false, false),
  ('cambridge','b1','tech','robot',        'noun', true,  true),
  ('cambridge','b1','tech','screen',       'noun', true,  true),
  ('cambridge','b1','tech','server',       'noun', true,  true),
  ('cambridge','b1','tech','smartphone',   'noun', true,  true),
  ('cambridge','b1','tech','social media', 'noun', false, false),
  ('cambridge','b1','tech','upload',       'noun', false, false),
  ('cambridge','b1','tech','video clip',   'noun', false, true),
  ('cambridge','b1','tech','webcam',       'noun', true,  true)
ON CONFLICT DO NOTHING;

-- ── TRANSPORT (new B1 additions) ──────────────────────────────────────────────
INSERT INTO public.bob_vocabulary
  (framework, cefr_level, category, word, word_type, pointable, object_card_friendly)
VALUES
  ('cambridge','b1','transport','airline',          'noun', false, true),
  ('cambridge','b1','transport','boarding pass',    'noun', false, true),
  ('cambridge','b1','transport','border',           'noun', false, false),
  ('cambridge','b1','transport','cab',              'noun', true,  true),
  ('cambridge','b1','transport','canal',            'noun', true,  true),
  ('cambridge','b1','transport','coach',            'noun', true,  true),
  ('cambridge','b1','transport','departure',        'noun', false, false),
  ('cambridge','b1','transport','destination',      'noun', false, false),
  ('cambridge','b1','transport','direction',        'noun', false, false),
  ('cambridge','b1','transport','driving licence',  'noun', false, true),
  ('cambridge','b1','transport','fare',             'noun', false, false),
  ('cambridge','b1','transport','ferry',            'noun', true,  true),
  ('cambridge','b1','transport','fuel',             'noun', false, false),
  ('cambridge','b1','transport','handlebars',       'noun', true,  true),
  ('cambridge','b1','transport','lorry',            'noun', true,  true),
  ('cambridge','b1','transport','motorcycle',       'noun', true,  true),
  ('cambridge','b1','transport','parking lot',      'noun', true,  true),
  ('cambridge','b1','transport','petrol',           'noun', false, false),
  ('cambridge','b1','transport','petrol station',   'noun', true,  true),
  ('cambridge','b1','transport','rail',             'noun', false, false),
  ('cambridge','b1','transport','road sign',        'noun', true,  true),
  ('cambridge','b1','transport','route',            'noun', false, false),
  ('cambridge','b1','transport','scooter',          'noun', true,  true),
  ('cambridge','b1','transport','seat belt',        'noun', true,  true),
  ('cambridge','b1','transport','signal',           'noun', true,  true),
  ('cambridge','b1','transport','skateboarding',    'noun', false, true),
  ('cambridge','b1','transport','speed',            'noun', false, false),
  ('cambridge','b1','transport','traffic jam',      'noun', false, true),
  ('cambridge','b1','transport','traffic lights',   'noun', true,  true),
  ('cambridge','b1','transport','tyre',             'noun', true,  true),
  ('cambridge','b1','transport','underground train','noun', true,  true),
  ('cambridge','b1','transport','vehicle',          'noun', true,  true),
  ('cambridge','b1','transport','visa',             'noun', false, true),
  ('cambridge','b1','transport','windscreen',       'noun', true,  true)
ON CONFLICT DO NOTHING;

-- ── TRAVEL (new category) ─────────────────────────────────────────────────────
INSERT INTO public.bob_vocabulary
  (framework, cefr_level, category, word, word_type, pointable, object_card_friendly)
VALUES
  ('cambridge','b1','travel','accommodation',         'noun', false, false),
  ('cambridge','b1','travel','arrival',               'noun', false, false),
  ('cambridge','b1','travel','backpacker',            'noun', false, false),
  ('cambridge','b1','travel','backpacking',           'noun', false, false),
  ('cambridge','b1','travel','booking',               'noun', false, false),
  ('cambridge','b1','travel','brochure',              'noun', false, true),
  ('cambridge','b1','travel','cabin',                 'noun', true,  true),
  ('cambridge','b1','travel','charter',               'noun', false, false),
  ('cambridge','b1','travel','check-in',              'noun', false, true),
  ('cambridge','b1','travel','currency',              'noun', false, false),
  ('cambridge','b1','travel','customs',               'noun', false, false),
  ('cambridge','b1','travel','delay',                 'noun', false, false),
  ('cambridge','b1','travel','duty-free',             'noun', false, true),
  ('cambridge','b1','travel','exchange rate',         'noun', false, false),
  ('cambridge','b1','travel','facilities',            'noun', false, false),
  ('cambridge','b1','travel','guidebook',             'noun', true,  true),
  ('cambridge','b1','travel','immigration',           'noun', false, false),
  ('cambridge','b1','travel','nationality',           'noun', false, false),
  ('cambridge','b1','travel','reservation',           'noun', false, false),
  ('cambridge','b1','travel','sightseeing',           'noun', false, false),
  ('cambridge','b1','travel','single room',           'noun', false, true),
  ('cambridge','b1','travel','souvenir',              'noun', true,  true),
  ('cambridge','b1','travel','tourism',               'noun', false, false),
  ('cambridge','b1','travel','tourist information centre','noun',true,true),
  ('cambridge','b1','travel','travel agent',          'noun', false, false),
  ('cambridge','b1','travel','waiting room',          'noun', true,  true)
ON CONFLICT DO NOTHING;

-- ── WEATHER (new category) ────────────────────────────────────────────────────
INSERT INTO public.bob_vocabulary
  (framework, cefr_level, category, word, word_type, pointable, object_card_friendly)
VALUES
  ('cambridge','b1','weather','breeze',        'noun', false, false),
  ('cambridge','b1','weather','centigrade',    'noun', false, false),
  ('cambridge','b1','weather','degrees',       'noun', false, false),
  ('cambridge','b1','weather','forecast',      'noun', false, true),
  ('cambridge','b1','weather','gale',          'noun', false, false),
  ('cambridge','b1','weather','humidity',      'noun', false, false),
  ('cambridge','b1','weather','lightning',     'noun', false, true),
  ('cambridge','b1','weather','shower',        'noun', false, true),
  ('cambridge','b1','weather','snowfall',      'noun', false, true),
  ('cambridge','b1','weather','temperature',   'noun', false, false),
  ('cambridge','b1','weather','thunder',       'noun', false, false),
  ('cambridge','b1','weather','thunderstorm',  'noun', true,  true),
  ('cambridge','b1','weather','weather forecast','noun',false, true)
ON CONFLICT DO NOTHING;

-- ── WORK (new category) ───────────────────────────────────────────────────────
INSERT INTO public.bob_vocabulary
  (framework, cefr_level, category, word, word_type, pointable, object_card_friendly)
VALUES
  ('cambridge','b1','work','application',  'noun', false, true),
  ('cambridge','b1','work','career',       'noun', false, false),
  ('cambridge','b1','work','company',      'noun', false, false),
  ('cambridge','b1','work','conference',   'noun', false, false),
  ('cambridge','b1','work','contract',     'noun', false, true),
  ('cambridge','b1','work','CV',           'noun', false, true),
  ('cambridge','b1','work','department',   'noun', false, false),
  ('cambridge','b1','work','employment',   'noun', false, false),
  ('cambridge','b1','work','firm',         'noun', false, false),
  ('cambridge','b1','work','interview',    'noun', false, false),
  ('cambridge','b1','work','occupation',   'noun', false, false),
  ('cambridge','b1','work','profession',   'noun', false, false),
  ('cambridge','b1','work','retirement',   'noun', false, false),
  ('cambridge','b1','work','salary',       'noun', false, false),
  ('cambridge','b1','work','trade',        'noun', false, false),
  ('cambridge','b1','work','unemployment', 'noun', false, false),
  ('cambridge','b1','work','wage',         'noun', false, false)
ON CONFLICT DO NOTHING;

-- ── MISC (new B1 additions not fitting other categories) ──────────────────────
INSERT INTO public.bob_vocabulary
  (framework, cefr_level, category, word, word_type, pointable, object_card_friendly)
VALUES
  ('cambridge','b1','misc','ability',      'noun', false, false),
  ('cambridge','b1','misc','achievement',  'noun', false, false),
  ('cambridge','b1','misc','action',       'noun', false, false),
  ('cambridge','b1','misc','advantage',    'noun', false, false),
  ('cambridge','b1','misc','agency',       'noun', false, false),
  ('cambridge','b1','misc','announcement', 'noun', false, false),
  ('cambridge','b1','misc','article',      'noun', false, true),
  ('cambridge','b1','misc','attempt',      'noun', false, false),
  ('cambridge','b1','misc','average',      'noun', false, false),
  ('cambridge','b1','misc','battle',       'noun', false, false),
  ('cambridge','b1','misc','conclusion',   'noun', false, false),
  ('cambridge','b1','misc','condition',    'noun', false, false),
  ('cambridge','b1','misc','connection',   'noun', false, false),
  ('cambridge','b1','misc','continent',    'noun', true,  false),
  ('cambridge','b1','misc','crime',        'noun', false, false),
  ('cambridge','b1','misc','culture',      'noun', false, false),
  ('cambridge','b1','misc','decision',     'noun', false, false),
  ('cambridge','b1','misc','description',  'noun', false, false),
  ('cambridge','b1','misc','detail',       'noun', false, false),
  ('cambridge','b1','misc','development',  'noun', false, false),
  ('cambridge','b1','misc','difference',   'noun', false, false),
  ('cambridge','b1','misc','difficulty',   'noun', false, false),
  ('cambridge','b1','misc','discovery',    'noun', false, false),
  ('cambridge','b1','misc','discussion',   'noun', false, false),
  ('cambridge','b1','misc','distance',     'noun', false, false),
  ('cambridge','b1','misc','effect',       'noun', false, false),
  ('cambridge','b1','misc','effort',       'noun', false, false),
  ('cambridge','b1','misc','energy',       'noun', false, false),
  ('cambridge','b1','misc','entertainment','noun', false, false),
  ('cambridge','b1','misc','environment',  'noun', false, false),
  ('cambridge','b1','misc','event',        'noun', false, false),
  ('cambridge','b1','misc','example',      'noun', false, false),
  ('cambridge','b1','misc','expedition',   'noun', false, false),
  ('cambridge','b1','misc','explanation',  'noun', false, false),
  ('cambridge','b1','misc','fact',         'noun', false, false),
  ('cambridge','b1','misc','fault',        'noun', false, false),
  ('cambridge','b1','misc','fee',          'noun', false, false),
  ('cambridge','b1','misc','figure',       'noun', false, false),
  ('cambridge','b1','misc','firework',     'noun', true,  true),
  ('cambridge','b1','misc','generation',   'noun', false, false),
  ('cambridge','b1','misc','government',   'noun', false, false),
  ('cambridge','b1','misc','grant',        'noun', false, false),
  ('cambridge','b1','misc','habit',        'noun', false, false),
  ('cambridge','b1','misc','headline',     'noun', false, false),
  ('cambridge','b1','misc','impact',       'noun', false, false),
  ('cambridge','b1','misc','improvement',  'noun', false, false),
  ('cambridge','b1','misc','independence', 'noun', false, false),
  ('cambridge','b1','misc','instance',     'noun', false, false),
  ('cambridge','b1','misc','issue',        'noun', false, false),
  ('cambridge','b1','misc','item',         'noun', false, false),
  ('cambridge','b1','misc','knowledge',    'noun', false, false),
  ('cambridge','b1','misc','lack',         'noun', false, false),
  ('cambridge','b1','misc','law',          'noun', false, false),
  ('cambridge','b1','misc','leader',       'noun', false, false),
  ('cambridge','b1','misc','length',       'noun', false, false),
  ('cambridge','b1','misc','link',         'noun', false, false),
  ('cambridge','b1','misc','literature',   'noun', false, false),
  ('cambridge','b1','misc','location',     'noun', false, false),
  ('cambridge','b1','misc','logo',         'noun', true,  true),
  ('cambridge','b1','misc','lottery',      'noun', false, false),
  ('cambridge','b1','misc','luxury',       'noun', false, false),
  ('cambridge','b1','misc','method',       'noun', false, false),
  ('cambridge','b1','misc','mystery',      'noun', false, false),
  ('cambridge','b1','misc','object',       'noun', false, false),
  ('cambridge','b1','misc','opportunity',  'noun', false, false),
  ('cambridge','b1','misc','option',       'noun', false, false),
  ('cambridge','b1','misc','organisation', 'noun', false, false),
  ('cambridge','b1','misc','pattern',      'noun', true,  true),
  ('cambridge','b1','misc','peace',        'noun', false, false),
  ('cambridge','b1','misc','period',       'noun', false, false),
  ('cambridge','b1','misc','population',   'noun', false, false),
  ('cambridge','b1','misc','position',     'noun', false, false),
  ('cambridge','b1','misc','possibility',  'noun', false, false),
  ('cambridge','b1','misc','power',        'noun', false, false),
  ('cambridge','b1','misc','problem',      'noun', false, false),
  ('cambridge','b1','misc','process',      'noun', false, false),
  ('cambridge','b1','misc','product',      'noun', false, false),
  ('cambridge','b1','misc','progress',     'noun', false, false),
  ('cambridge','b1','misc','quality',      'noun', false, false),
  ('cambridge','b1','misc','quantity',     'noun', false, false),
  ('cambridge','b1','misc','reason',       'noun', false, false),
  ('cambridge','b1','misc','region',       'noun', false, false),
  ('cambridge','b1','misc','result',       'noun', false, false),
  ('cambridge','b1','misc','reward',       'noun', false, false),
  ('cambridge','b1','misc','role',         'noun', false, false),
  ('cambridge','b1','misc','rule',         'noun', false, false),
  ('cambridge','b1','misc','section',      'noun', false, false),
  ('cambridge','b1','misc','security',     'noun', false, false),
  ('cambridge','b1','misc','sense',        'noun', false, false),
  ('cambridge','b1','misc','situation',    'noun', false, false),
  ('cambridge','b1','misc','size',         'noun', false, false),
  ('cambridge','b1','misc','skill',        'noun', false, false),
  ('cambridge','b1','misc','solution',     'noun', false, false),
  ('cambridge','b1','misc','sort',         'noun', false, false),
  ('cambridge','b1','misc','soul',         'noun', false, false),
  ('cambridge','b1','misc','space',        'noun', false, false),
  ('cambridge','b1','misc','speech',       'noun', false, false),
  ('cambridge','b1','misc','speed',        'noun', false, false),
  ('cambridge','b1','misc','style',        'noun', false, false),
  ('cambridge','b1','misc','success',      'noun', false, false),
  ('cambridge','b1','misc','suggestion',   'noun', false, false),
  ('cambridge','b1','misc','system',       'noun', false, false),
  ('cambridge','b1','misc','tax',          'noun', false, false),
  ('cambridge','b1','misc','technique',    'noun', false, false),
  ('cambridge','b1','misc','technology',   'noun', false, false),
  ('cambridge','b1','misc','truth',        'noun', false, false),
  ('cambridge','b1','misc','value',        'noun', false, false),
  ('cambridge','b1','misc','variety',      'noun', false, false),
  ('cambridge','b1','misc','version',      'noun', false, false),
  ('cambridge','b1','misc','weight',       'noun', false, false),
  ('cambridge','b1','misc','youth',        'noun', false, false)
ON CONFLICT DO NOTHING;
