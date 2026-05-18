-- Migration 47: Seed B2 vocabulary (Cambridge FCE)
-- Source: Objective First Wordlist with definitions (Cambridge University Press, 3rd edition)
-- Strategy: cumulative — copy all B1 rows, then insert new B2-only words

-- 1. Copy all B1 rows to B2 (B2 is cumulative)
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly, notes)
SELECT framework, 'b2', category, word, word_type, pointable, object_card_friendly, notes
FROM public.bob_vocabulary
WHERE cefr_level = 'b1' AND framework = 'cambridge'
ON CONFLICT DO NOTHING;

-- 2. Insert new B2-only words
-- Batch A: clothes / shopping / appearance (Unit 1)
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly) VALUES
  ('cambridge', 'b2', 'clothes', 'bargain', 'noun', true, true),
  ('cambridge', 'b2', 'clothes', 'casual', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'comparison', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'distinguish', 'verb', false, false),
  ('cambridge', 'b2', 'misc', 'dominate', 'verb', false, false),
  ('cambridge', 'b2', 'misc', 'genuine', 'adj', false, false),
  ('cambridge', 'b2', 'clothes', 'hood', 'noun', true, true),
  ('cambridge', 'b2', 'clothes', 'outfit', 'noun', true, true),
  ('cambridge', 'b2', 'misc', 'outrageous', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'represent', 'verb', false, false),
  ('cambridge', 'b2', 'misc', 'slightly', 'adv', false, false),
  ('cambridge', 'b2', 'misc', 'smart', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'stunning', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'stylish', 'adj', false, false)
ON CONFLICT DO NOTHING;

-- Batch B: technology / entertainment (Unit 2)
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly) VALUES
  ('cambridge', 'b2', 'misc', 'accessible', 'adj', false, false),
  ('cambridge', 'b2', 'home', 'appliance', 'noun', true, true),
  ('cambridge', 'b2', 'misc', 'complex', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'demanding', 'adj', false, false),
  ('cambridge', 'b2', 'feelings', 'disappointed', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'facility', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'favourable', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'feature', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'fortune', 'noun', false, false),
  ('cambridge', 'b2', 'tech', 'graphics', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'hopeless', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'impressive', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'meaningful', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'messy', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'opponent', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'pace', 'noun', false, false),
  ('cambridge', 'b2', 'social', 'popularity', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'sophisticated', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'submit', 'verb', false, false),
  ('cambridge', 'b2', 'misc', 'tricky', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'unhelpful', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'violent', 'adj', false, false),
  ('cambridge', 'b2', 'tech', 'virtual', 'adj', false, false)
ON CONFLICT DO NOTHING;

-- Batch C: travel / transport (Unit 3)
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly) VALUES
  ('cambridge', 'b2', 'travel', 'approach', 'noun', false, false),
  ('cambridge', 'b2', 'travel', 'check in', 'verb', false, false),
  ('cambridge', 'b2', 'travel', 'check out', 'verb', false, false),
  ('cambridge', 'b2', 'misc', 'disturb', 'verb', false, false),
  ('cambridge', 'b2', 'travel', 'domestic', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'forbid', 'verb', false, false),
  ('cambridge', 'b2', 'places', 'ground', 'noun', false, false),
  ('cambridge', 'b2', 'travel', 'land', 'verb', false, false),
  ('cambridge', 'b2', 'travel', 'landing', 'noun', false, false),
  ('cambridge', 'b2', 'travel', 'set off', 'verb', false, false),
  ('cambridge', 'b2', 'travel', 'stop over', 'verb', false, false),
  ('cambridge', 'b2', 'transport', 'take off', 'verb', false, false),
  ('cambridge', 'b2', 'transport', 'terminal', 'noun', true, true),
  ('cambridge', 'b2', 'travel', 'yacht', 'noun', true, true)
ON CONFLICT DO NOTHING;

-- Batch D: nature / environment / animals (Unit 4)
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly) VALUES
  ('cambridge', 'b2', 'animals', 'breed', 'verb', false, false),
  ('cambridge', 'b2', 'environment', 'conservation', 'noun', false, false),
  ('cambridge', 'b2', 'environment', 'conserve', 'verb', false, false),
  ('cambridge', 'b2', 'environment', 'destruction', 'noun', false, false),
  ('cambridge', 'b2', 'animals', 'endangered', 'adj', false, false),
  ('cambridge', 'b2', 'environment', 'global warming', 'noun', false, false),
  ('cambridge', 'b2', 'animals', 'paw', 'noun', true, false),
  ('cambridge', 'b2', 'environment', 'pollute', 'verb', false, false),
  ('cambridge', 'b2', 'nature', 'wild', 'noun', false, false)
ON CONFLICT DO NOTHING;

-- Batch E: feelings / emotions (Unit 5)
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly) VALUES
  ('cambridge', 'b2', 'misc', 'absolutely', 'adv', false, false),
  ('cambridge', 'b2', 'feelings', 'anxious', 'adj', false, false),
  ('cambridge', 'b2', 'feelings', 'astonished', 'adj', false, false),
  ('cambridge', 'b2', 'feelings', 'content', 'adj', false, false),
  ('cambridge', 'b2', 'feelings', 'delighted', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'extremely', 'adv', false, false),
  ('cambridge', 'b2', 'feelings', 'frightened', 'adj', false, false),
  ('cambridge', 'b2', 'feelings', 'furious', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'grab', 'verb', false, true),
  ('cambridge', 'b2', 'feelings', 'irritated', 'adj', false, false),
  ('cambridge', 'b2', 'feelings', 'petrified', 'adj', false, false),
  ('cambridge', 'b2', 'weather', 'pour', 'verb', false, false),
  ('cambridge', 'b2', 'feelings', 'relieved', 'adj', false, false),
  ('cambridge', 'b2', 'feelings', 'satisfied', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'shake', 'verb', false, false),
  ('cambridge', 'b2', 'feelings', 'terrified', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'totally', 'adv', false, false),
  ('cambridge', 'b2', 'feelings', 'uneasy', 'adj', false, false),
  ('cambridge', 'b2', 'feelings', 'tense', 'adj', false, false)
ON CONFLICT DO NOTHING;

-- Batch F: media / celebrity / communication (Unit 6)
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly) VALUES
  ('cambridge', 'b2', 'entertainment', 'appearance', 'noun', false, false),
  ('cambridge', 'b2', 'media', 'broadcast', 'verb', false, false),
  ('cambridge', 'b2', 'misc', 'breakdown', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'case', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'delicate', 'adj', false, false),
  ('cambridge', 'b2', 'social', 'fame', 'noun', false, false),
  ('cambridge', 'b2', 'language', 'fluent', 'adj', false, false),
  ('cambridge', 'b2', 'media', 'impressed', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'inspiration', 'noun', false, false),
  ('cambridge', 'b2', 'work', 'living', 'noun', false, false),
  ('cambridge', 'b2', 'social', 'privacy', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'regional', 'adj', false, false),
  ('cambridge', 'b2', 'media', 'scandal', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'sensation', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'understandable', 'adj', false, false)
ON CONFLICT DO NOTHING;

-- Batch G: sports (Unit 7)
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly) VALUES
  ('cambridge', 'b2', 'sports_music', 'cheer', 'verb', false, false),
  ('cambridge', 'b2', 'sports_music', 'fall apart', 'verb', false, false),
  ('cambridge', 'b2', 'sports_music', 'ice skate', 'verb', false, false),
  ('cambridge', 'b2', 'sports_music', 'lap', 'noun', false, false),
  ('cambridge', 'b2', 'sports_music', 'referee', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'row', 'verb', false, false),
  ('cambridge', 'b2', 'misc', 'scary', 'adj', false, false),
  ('cambridge', 'b2', 'sports_music', 'spectator', 'noun', false, false),
  ('cambridge', 'b2', 'sports_music', 'track', 'noun', true, true)
ON CONFLICT DO NOTHING;

-- Batch H: social / family / relationships (Unit 8)
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly) VALUES
  ('cambridge', 'b2', 'misc', 'affect', 'verb', false, false),
  ('cambridge', 'b2', 'misc', 'confident', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'critical', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'disapprove', 'verb', false, false),
  ('cambridge', 'b2', 'social', 'proud', 'adj', false, false),
  ('cambridge', 'b2', 'social', 'selfish', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'sensible', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'share', 'verb', false, false),
  ('cambridge', 'b2', 'home', 'storey', 'noun', false, false)
ON CONFLICT DO NOTHING;

-- Batch I: film / media / advertising (Unit 9)
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly) VALUES
  ('cambridge', 'b2', 'media', 'advertise', 'verb', false, false),
  ('cambridge', 'b2', 'misc', 'brand', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'budget', 'noun', false, false),
  ('cambridge', 'b2', 'entertainment', 'character', 'noun', false, false),
  ('cambridge', 'b2', 'media', 'commercial', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'deadline', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'doubt', 'verb', false, false),
  ('cambridge', 'b2', 'misc', 'dramatic', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'element', 'noun', false, false),
  ('cambridge', 'b2', 'entertainment', 'ending', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'huge', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'narrow', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'powerful', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'reckon', 'verb', false, false),
  ('cambridge', 'b2', 'entertainment', 'setting', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'shallow', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'view', 'noun', false, false)
ON CONFLICT DO NOTHING;

-- Batch J: science / space / ethics (Unit 10)
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly) VALUES
  ('cambridge', 'b2', 'misc', 'access', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'achievement', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'concept', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'decade', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'illegal', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'immoral', 'adj', false, false),
  ('cambridge', 'b2', 'feelings', 'impatient', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'inappropriate', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'inexperienced', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'irregular', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'irresponsible', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'prove', 'verb', false, false),
  ('cambridge', 'b2', 'misc', 'scientific', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'significant', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'sponsor', 'verb', false, false),
  ('cambridge', 'b2', 'misc', 'willingness', 'noun', false, false)
ON CONFLICT DO NOTHING;

-- Batch K: personality / people (Unit 11)
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly) VALUES
  ('cambridge', 'b2', 'people', 'aggressive', 'adj', false, false),
  ('cambridge', 'b2', 'people', 'blush', 'verb', false, false),
  ('cambridge', 'b2', 'people', 'bossy', 'adj', false, false),
  ('cambridge', 'b2', 'people', 'characteristic', 'noun', false, false),
  ('cambridge', 'b2', 'people', 'cheerful', 'adj', false, false),
  ('cambridge', 'b2', 'people', 'competitive', 'adj', false, false),
  ('cambridge', 'b2', 'people', 'discourage', 'verb', false, false),
  ('cambridge', 'b2', 'people', 'identical', 'adj', false, false),
  ('cambridge', 'b2', 'people', 'identity', 'noun', false, false),
  ('cambridge', 'b2', 'feelings', 'jealous', 'adj', false, false),
  ('cambridge', 'b2', 'people', 'lazy', 'adj', false, false),
  ('cambridge', 'b2', 'people', 'loyal', 'adj', false, false),
  ('cambridge', 'b2', 'people', 'optimistic', 'adj', false, false),
  ('cambridge', 'b2', 'people', 'resemble', 'verb', false, false),
  ('cambridge', 'b2', 'people', 'stubborn', 'adj', false, false),
  ('cambridge', 'b2', 'people', 'unpopular', 'adj', false, false),
  ('cambridge', 'b2', 'people', 'unreliable', 'adj', false, false),
  ('cambridge', 'b2', 'people', 'witty', 'adj', false, false)
ON CONFLICT DO NOTHING;

-- Batch L: food / home (Unit 12)
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly) VALUES
  ('cambridge', 'b2', 'home', 'attic', 'noun', true, true),
  ('cambridge', 'b2', 'misc', 'complaint', 'noun', false, false),
  ('cambridge', 'b2', 'home', 'crockery', 'noun', true, true),
  ('cambridge', 'b2', 'food_drink', 'crunchy', 'adj', false, false),
  ('cambridge', 'b2', 'home', 'cutlery', 'noun', true, true),
  ('cambridge', 'b2', 'misc', 'devise', 'verb', false, false),
  ('cambridge', 'b2', 'misc', 'duplicate', 'verb', false, false),
  ('cambridge', 'b2', 'food_drink', 'groceries', 'noun', true, true),
  ('cambridge', 'b2', 'health', 'infection', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'inventor', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'ritual', 'noun', false, false),
  ('cambridge', 'b2', 'food_drink', 'soggy', 'adj', false, false),
  ('cambridge', 'b2', 'food_drink', 'stale', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'substance', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'suspicion', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'transform', 'verb', false, false)
ON CONFLICT DO NOTHING;

-- Batch M: education / work / speech acts (Unit 13)
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly) VALUES
  ('cambridge', 'b2', 'misc', 'accuse', 'verb', false, false),
  ('cambridge', 'b2', 'misc', 'apologise', 'verb', false, false),
  ('cambridge', 'b2', 'misc', 'claim', 'verb', false, false),
  ('cambridge', 'b2', 'misc', 'deny', 'verb', false, false),
  ('cambridge', 'b2', 'school', 'educate', 'verb', false, false),
  ('cambridge', 'b2', 'school', 'educated', 'adj', false, false),
  ('cambridge', 'b2', 'school', 'educational', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'insist', 'verb', false, false),
  ('cambridge', 'b2', 'misc', 'mention', 'verb', false, false),
  ('cambridge', 'b2', 'misc', 'promise', 'verb', false, false),
  ('cambridge', 'b2', 'misc', 'refuse', 'verb', false, false),
  ('cambridge', 'b2', 'misc', 'relevant', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'standard', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'urge', 'verb', false, false),
  ('cambridge', 'b2', 'misc', 'warn', 'verb', false, false),
  ('cambridge', 'b2', 'misc', 'wish', 'verb', false, false)
ON CONFLICT DO NOTHING;

-- Batch N: work / jobs (Unit 14)
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly) VALUES
  ('cambridge', 'b2', 'misc', 'adventurous', 'adj', false, false),
  ('cambridge', 'b2', 'people', 'background', 'noun', false, false),
  ('cambridge', 'b2', 'work', 'commitment', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'concerned', 'adj', false, false),
  ('cambridge', 'b2', 'people', 'dishonest', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'disorganised', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'dissatisfied', 'adj', false, false),
  ('cambridge', 'b2', 'work', 'enthusiasm', 'noun', false, false),
  ('cambridge', 'b2', 'work', 'enthusiastic', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'flexible', 'adj', false, false),
  ('cambridge', 'b2', 'work', 'redundant', 'adj', false, false),
  ('cambridge', 'b2', 'work', 'responsibility', 'noun', false, false),
  ('cambridge', 'b2', 'work', 'responsible', 'adj', false, false),
  ('cambridge', 'b2', 'work', 'routine', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'secure', 'adj', false, false),
  ('cambridge', 'b2', 'people', 'self-confident', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'uncertain', 'adj', false, false),
  ('cambridge', 'b2', 'work', 'unemployment benefit', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'unsuccessful', 'adj', false, false)
ON CONFLICT DO NOTHING;

-- Batch O: environment / water / resources (Unit 15)
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly) VALUES
  ('cambridge', 'b2', 'places', 'canal', 'noun', true, true),
  ('cambridge', 'b2', 'nature', 'dam', 'noun', true, true),
  ('cambridge', 'b2', 'misc', 'economical', 'adj', false, false),
  ('cambridge', 'b2', 'environment', 'environmentally friendly', 'adj', false, false),
  ('cambridge', 'b2', 'weather', 'flash', 'noun', false, false),
  ('cambridge', 'b2', 'environment', 'fossil fuel', 'noun', false, false),
  ('cambridge', 'b2', 'home', 'household', 'noun', false, false),
  ('cambridge', 'b2', 'home', 'pane', 'noun', true, true),
  ('cambridge', 'b2', 'nature', 'rapids', 'noun', true, false),
  ('cambridge', 'b2', 'environment', 'recycle', 'verb', false, false),
  ('cambridge', 'b2', 'nature', 'reservoir', 'noun', true, true),
  ('cambridge', 'b2', 'misc', 'second-hand', 'adj', false, false),
  ('cambridge', 'b2', 'nature', 'vegetation', 'noun', false, true)
ON CONFLICT DO NOTHING;

-- Batch P: food / taste / cooking (Unit 16)
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly) VALUES
  ('cambridge', 'b2', 'food_drink', 'appealing', 'adj', false, false),
  ('cambridge', 'b2', 'food_drink', 'appetite', 'noun', false, false),
  ('cambridge', 'b2', 'food_drink', 'bitter', 'adj', false, false),
  ('cambridge', 'b2', 'food_drink', 'canned', 'adj', false, false),
  ('cambridge', 'b2', 'food_drink', 'consume', 'verb', false, false),
  ('cambridge', 'b2', 'food_drink', 'consumer', 'noun', false, false),
  ('cambridge', 'b2', 'food_drink', 'dairy', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'finding', 'noun', false, false),
  ('cambridge', 'b2', 'food_drink', 'fizzy', 'adj', false, false),
  ('cambridge', 'b2', 'food_drink', 'flat', 'adj', false, false),
  ('cambridge', 'b2', 'food_drink', 'flavour', 'noun', false, false),
  ('cambridge', 'b2', 'food_drink', 'grill', 'verb', false, false),
  ('cambridge', 'b2', 'misc', 'influence', 'verb', false, false),
  ('cambridge', 'b2', 'food_drink', 'juicy', 'adj', false, false),
  ('cambridge', 'b2', 'food_drink', 'melt', 'verb', false, false),
  ('cambridge', 'b2', 'food_drink', 'mild', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'packaging', 'noun', true, true),
  ('cambridge', 'b2', 'misc', 'reject', 'verb', false, false),
  ('cambridge', 'b2', 'food_drink', 'rich', 'adj', false, false),
  ('cambridge', 'b2', 'food_drink', 'ripe', 'adj', false, false),
  ('cambridge', 'b2', 'food_drink', 'rotten', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'sense', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'texture', 'noun', false, false)
ON CONFLICT DO NOTHING;

-- Batch Q: hobbies / collections (Unit 17)
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly) VALUES
  ('cambridge', 'b2', 'misc', 'amount', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'challenge', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'collector', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'collection', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'delightful', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'elegant', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'exceptional', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'massive', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'obsession', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'passion', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'remarkable', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'scale', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'substantial', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'vast', 'adj', false, false)
ON CONFLICT DO NOTHING;

-- Batch R: books / literature / narrative (Unit 18)
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly) VALUES
  ('cambridge', 'b2', 'misc', 'alternative', 'noun', false, false),
  ('cambridge', 'b2', 'entertainment', 'biography', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'effective', 'adj', false, false),
  ('cambridge', 'b2', 'entertainment', 'extract', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'form', 'noun', false, false),
  ('cambridge', 'b2', 'entertainment', 'science fiction', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'sight', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'strength', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'surface', 'noun', false, false),
  ('cambridge', 'b2', 'tech', 'technological', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'trace', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'visual', 'adj', false, false)
ON CONFLICT DO NOTHING;

-- Batch S: health / body (Unit 19)
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly) VALUES
  ('cambridge', 'b2', 'health', 'bug', 'noun', false, false),
  ('cambridge', 'b2', 'health', 'burn', 'verb', false, false),
  ('cambridge', 'b2', 'body', 'chest', 'noun', true, false),
  ('cambridge', 'b2', 'health', 'cough medicine', 'noun', true, true),
  ('cambridge', 'b2', 'body', 'eyebrow', 'noun', true, false),
  ('cambridge', 'b2', 'health', 'faint', 'verb', false, false),
  ('cambridge', 'b2', 'health', 'graze', 'verb', false, false),
  ('cambridge', 'b2', 'body', 'jaw', 'noun', true, false),
  ('cambridge', 'b2', 'body', 'knee', 'noun', true, false),
  ('cambridge', 'b2', 'health', 'needle', 'noun', true, true),
  ('cambridge', 'b2', 'health', 'plaster', 'noun', true, true),
  ('cambridge', 'b2', 'body', 'scar', 'noun', true, false),
  ('cambridge', 'b2', 'health', 'sprain', 'verb', false, false),
  ('cambridge', 'b2', 'health', 'sting', 'verb', false, false),
  ('cambridge', 'b2', 'health', 'stitch', 'noun', false, false),
  ('cambridge', 'b2', 'health', 'surgery', 'noun', false, false),
  ('cambridge', 'b2', 'health', 'sweat', 'noun', false, false),
  ('cambridge', 'b2', 'health', 'symptom', 'noun', false, false),
  ('cambridge', 'b2', 'body', 'thigh', 'noun', true, false),
  ('cambridge', 'b2', 'body', 'waist', 'noun', true, false),
  ('cambridge', 'b2', 'health', 'ward', 'noun', true, true),
  ('cambridge', 'b2', 'body', 'wrist', 'noun', true, false)
ON CONFLICT DO NOTHING;

-- Batch T: crime / law (Unit 20)
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly) VALUES
  ('cambridge', 'b2', 'social', 'arrest', 'verb', false, false),
  ('cambridge', 'b2', 'social', 'burglar', 'noun', false, false),
  ('cambridge', 'b2', 'social', 'cell', 'noun', true, true),
  ('cambridge', 'b2', 'social', 'charge', 'verb', false, false),
  ('cambridge', 'b2', 'misc', 'DNA', 'noun', false, false),
  ('cambridge', 'b2', 'social', 'fine', 'noun', false, false),
  ('cambridge', 'b2', 'social', 'fingerprint', 'noun', true, true),
  ('cambridge', 'b2', 'social', 'forensic', 'adj', false, false),
  ('cambridge', 'b2', 'social', 'guilty', 'adj', false, false),
  ('cambridge', 'b2', 'social', 'innocent', 'adj', false, false),
  ('cambridge', 'b2', 'social', 'jury', 'noun', false, false),
  ('cambridge', 'b2', 'social', 'kidnap', 'verb', false, false),
  ('cambridge', 'b2', 'social', 'offence', 'noun', false, false),
  ('cambridge', 'b2', 'social', 'pickpocket', 'noun', false, false),
  ('cambridge', 'b2', 'social', 'proof', 'noun', false, false),
  ('cambridge', 'b2', 'social', 'punishment', 'noun', false, false),
  ('cambridge', 'b2', 'social', 'robbery', 'noun', false, false),
  ('cambridge', 'b2', 'social', 'sentence', 'verb', false, false),
  ('cambridge', 'b2', 'social', 'shoplift', 'verb', false, false),
  ('cambridge', 'b2', 'social', 'steal', 'verb', false, false),
  ('cambridge', 'b2', 'social', 'suspect', 'noun', false, false),
  ('cambridge', 'b2', 'social', 'suspicious', 'adj', false, false),
  ('cambridge', 'b2', 'social', 'thief', 'noun', false, false),
  ('cambridge', 'b2', 'social', 'trial', 'noun', false, false)
ON CONFLICT DO NOTHING;

-- Batch U: cities / urban life (Unit 21)
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly) VALUES
  ('cambridge', 'b2', 'misc', 'absence', 'noun', false, false),
  ('cambridge', 'b2', 'places', 'architecture', 'noun', false, false),
  ('cambridge', 'b2', 'social', 'community', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'environmental', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'lack', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'lifestyle', 'noun', false, false),
  ('cambridge', 'b2', 'home', 'lighting', 'noun', false, false),
  ('cambridge', 'b2', 'home', 'maintenance', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'regulation', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'renew', 'verb', false, false),
  ('cambridge', 'b2', 'misc', 'renewal', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'requirement', 'noun', false, false),
  ('cambridge', 'b2', 'places', 'resident', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'shortage', 'noun', false, false),
  ('cambridge', 'b2', 'places', 'suburb', 'noun', true, true),
  ('cambridge', 'b2', 'places', 'suburban', 'adj', false, false),
  ('cambridge', 'b2', 'places', 'urban', 'adj', false, false)
ON CONFLICT DO NOTHING;

-- Batch V: music / performance / arts (Unit 22)
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly) VALUES
  ('cambridge', 'b2', 'sports_music', 'choir', 'noun', false, false),
  ('cambridge', 'b2', 'sports_music', 'composer', 'noun', false, false),
  ('cambridge', 'b2', 'sports_music', 'composition', 'noun', false, false),
  ('cambridge', 'b2', 'sports_music', 'conductor', 'noun', false, false),
  ('cambridge', 'b2', 'sports_music', 'gig', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'memorable', 'adj', false, false),
  ('cambridge', 'b2', 'sports_music', 'orchestral', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'organiser', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'participate', 'verb', false, false),
  ('cambridge', 'b2', 'misc', 'partnership', 'noun', false, false),
  ('cambridge', 'b2', 'sports_music', 'perform', 'verb', false, false),
  ('cambridge', 'b2', 'sports_music', 'rehearsal', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'respectable', 'adj', false, false),
  ('cambridge', 'b2', 'sports_music', 'solo', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'specialise', 'verb', false, false),
  ('cambridge', 'b2', 'places', 'venue', 'noun', true, true),
  ('cambridge', 'b2', 'misc', 'unique', 'adj', false, false)
ON CONFLICT DO NOTHING;

-- Batch W: weather / natural disasters (Unit 23)
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly) VALUES
  ('cambridge', 'b2', 'environment', 'ash', 'noun', true, false),
  ('cambridge', 'b2', 'misc', 'crack', 'noun', true, true),
  ('cambridge', 'b2', 'weather', 'damp', 'adj', false, false),
  ('cambridge', 'b2', 'weather', 'drought', 'noun', false, false),
  ('cambridge', 'b2', 'nature', 'earthquake', 'noun', false, false),
  ('cambridge', 'b2', 'nature', 'eruption', 'noun', false, false),
  ('cambridge', 'b2', 'weather', 'humid', 'adj', false, false),
  ('cambridge', 'b2', 'weather', 'hurricane', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'invaluable', 'adj', false, false),
  ('cambridge', 'b2', 'nature', 'peak', 'noun', true, true),
  ('cambridge', 'b2', 'environment', 'preserve', 'verb', false, false),
  ('cambridge', 'b2', 'misc', 'priceless', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'sensitive', 'adj', false, false),
  ('cambridge', 'b2', 'misc', 'tremble', 'verb', false, false),
  ('cambridge', 'b2', 'nature', 'volcano', 'noun', true, true)
ON CONFLICT DO NOTHING;

-- Batch X: entertainment / misc (Unit 24)
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly) VALUES
  ('cambridge', 'b2', 'misc', 'apparently', 'adv', false, false),
  ('cambridge', 'b2', 'entertainment', 'comedian', 'noun', false, false),
  ('cambridge', 'b2', 'entertainment', 'comedy', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'disguise', 'noun', false, false),
  ('cambridge', 'b2', 'work', 'earnings', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'estimate', 'verb', false, false),
  ('cambridge', 'b2', 'misc', 'ignore', 'verb', false, false),
  ('cambridge', 'b2', 'home', 'landlord', 'noun', false, false),
  ('cambridge', 'b2', 'misc', 'weird', 'adj', false, false)
ON CONFLICT DO NOTHING;

-- Batch Y: media category (new category)
INSERT INTO public.bob_vocabulary (framework, cefr_level, category, word, word_type, pointable, object_card_friendly) VALUES
  ('cambridge', 'b2', 'media', 'the press', 'noun', false, false)
ON CONFLICT DO NOTHING;
