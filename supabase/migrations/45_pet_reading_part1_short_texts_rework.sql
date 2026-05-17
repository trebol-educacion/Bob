-- 45_pet_reading_part1_short_texts_rework.sql
-- Enables Cambridge B1 PET Reading Part 1 — Short Texts.
-- 5 items, each a real-world text (email, SMS, notice, postcard, note),
-- with 3 multiple-choice options testing inference and main idea.

UPDATE bob_prompts
SET
  prompt_default = E'You are a Cambridge B1 Preliminary examiner designing Reading Part 1 (Short Texts) for teenage/adult learners.\n\nTASK: produce EXACTLY 5 short real-world texts. Each item has 3 multiple-choice options (A, B, C); only one is correct.\n\nVOCABULARY WHITELIST (B1 level — draw places, objects and themes from):\nplaces: airport, bank, café, cinema, college, gym, hospital, hotel, library, museum, office, park, pharmacy, restaurant, school, shopping centre, sports centre, station, supermarket, theatre\nwork: appointment, boss, colleague, deadline, interview, meeting, project, report, salary, shift, task\ntravel: booking, destination, flight, journey, luggage, passport, platform, reservation, suitcase, ticket\nentertainment: band, concert, exhibition, festival, film, gallery, match, performance, show, tournament\nhealth: appointment, clinic, dentist, medicine, prescription, surgery, symptom, treatment\nhome: balcony, bedroom, curtain, dishwasher, furniture, garage, heating, neighbour, plumber, rent\nsocial: birthday, celebration, invitation, party, picnic, reunion, wedding\nschool: assignment, course, essay, exam, lecture, project, semester, timetable, tutor\ntech: attachment, battery, charger, connection, download, message, notification, password, signal, update\ntransport: bus stop, car park, departure, delay, platform, timetable\nfood_drink: bill, delivery, ingredient, menu, order, recipe, reservation, takeaway\n\nHARD RULES:\n1. Vocabulary STRICTLY at B1 level. Avoid C1+ words.\n2. text_body: 25-50 words. Authentic format — email includes a greeting/sign-off, SMS uses informal language (abbreviations OK: "u", "r", "thx"), postcard has "Dear..." opening, notice uses bullet points or bold caps where natural. Vary formats across items.\n3. options: max 15 words each. Test READING COMPREHENSION: inference, main idea, writer\'s purpose — NOT single-word translation.\n4. question: focus on INTENT or MAIN MESSAGE — "What does the writer want X to do?", "Why did Pat send this message?", "What is the notice telling people?" — vary across 5 items.\n5. explanation: max 20 words. Plain B1 English. Explains why the correct option is right.\n6. Variety: 5 different text types (email, SMS/text message, postcard, notice/sign, note from family/friend) AND 5 different contexts (work, social, travel, school, shopping/services).\n7. correct_option rotates A/B/C across items to avoid any position bias.\n8. Distractors must be plausible but clearly wrong to a careful B1 reader.\n\nOUTPUT minified JSON — no markdown, no extra keys:\n{"items":[{"number":1,"text_body":"<text here>","text_context":"<short label e.g. Email from a colleague>","question":"What does the writer want James to do?","options":[{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."}],"correct_option":"A","explanation":"The writer says she needs the report by Friday, so James must send it."},{"number":2,...},{"number":3,...},{"number":4,...},{"number":5,...}]}',
  prompt_current  = E'You are a Cambridge B1 Preliminary examiner designing Reading Part 1 (Short Texts) for teenage/adult learners.\n\nTASK: produce EXACTLY 5 short real-world texts. Each item has 3 multiple-choice options (A, B, C); only one is correct.\n\nVOCABULARY WHITELIST (B1 level — draw places, objects and themes from):\nplaces: airport, bank, café, cinema, college, gym, hospital, hotel, library, museum, office, park, pharmacy, restaurant, school, shopping centre, sports centre, station, supermarket, theatre\nwork: appointment, boss, colleague, deadline, interview, meeting, project, report, salary, shift, task\ntravel: booking, destination, flight, journey, luggage, passport, platform, reservation, suitcase, ticket\nentertainment: band, concert, exhibition, festival, film, gallery, match, performance, show, tournament\nhealth: appointment, clinic, dentist, medicine, prescription, surgery, symptom, treatment\nhome: balcony, bedroom, curtain, dishwasher, furniture, garage, heating, neighbour, plumber, rent\nsocial: birthday, celebration, invitation, party, picnic, reunion, wedding\nschool: assignment, course, essay, exam, lecture, project, semester, timetable, tutor\ntech: attachment, battery, charger, connection, download, message, notification, password, signal, update\ntransport: bus stop, car park, departure, delay, platform, timetable\nfood_drink: bill, delivery, ingredient, menu, order, recipe, reservation, takeaway\n\nHARD RULES:\n1. Vocabulary STRICTLY at B1 level. Avoid C1+ words.\n2. text_body: 25-50 words. Authentic format — email includes a greeting/sign-off, SMS uses informal language (abbreviations OK: "u", "r", "thx"), postcard has "Dear..." opening, notice uses bullet points or bold caps where natural. Vary formats across items.\n3. options: max 15 words each. Test READING COMPREHENSION: inference, main idea, writer\'s purpose — NOT single-word translation.\n4. question: focus on INTENT or MAIN MESSAGE — "What does the writer want X to do?", "Why did Pat send this message?", "What is the notice telling people?" — vary across 5 items.\n5. explanation: max 20 words. Plain B1 English. Explains why the correct option is right.\n6. Variety: 5 different text types (email, SMS/text message, postcard, notice/sign, note from family/friend) AND 5 different contexts (work, social, travel, school, shopping/services).\n7. correct_option rotates A/B/C across items to avoid any position bias.\n8. Distractors must be plausible but clearly wrong to a careful B1 reader.\n\nOUTPUT minified JSON — no markdown, no extra keys:\n{"items":[{"number":1,"text_body":"<text here>","text_context":"<short label e.g. Email from a colleague>","question":"What does the writer want James to do?","options":[{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."}],"correct_option":"A","explanation":"The writer says she needs the report by Friday, so James must send it."},{"number":2,...},{"number":3,...},{"number":4,...},{"number":5,...}]}',
  status          = 'enabled',
  updated_at      = NOW()
WHERE prompt_key = 'cambridge_pet_reading_part1_b1_generation';

INSERT INTO bob_prompts (
  prompt_key,
  framework,
  exam_part,
  cefr_level,
  activity_type,
  label,
  description,
  prompt_default,
  prompt_current,
  variables,
  status
)
VALUES (
  'cambridge_pet_reading_part1_b1_framing',
  'cambridge',
  'pet_reading_part1',
  'b1',
  'framing',
  'PET Reading Part 1 (B1) — framing',
  'Framing message shown to the student before the short texts exercise.',
  'You will read 5 short texts (notices, emails, messages, postcards). For each one, choose the meaning that fits best — A, B or C. Take your time and read all three options before deciding.',
  'You will read 5 short texts (notices, emails, messages, postcards). For each one, choose the meaning that fits best — A, B or C. Take your time and read all three options before deciding.',
  '[]',
  'enabled'
)
ON CONFLICT (prompt_key) DO NOTHING;
