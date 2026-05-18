BEGIN;

ALTER TABLE bob_closed_items
  ADD COLUMN IF NOT EXISTS skill text NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'enabled'
    CHECK (status IN ('enabled','disabled','draft')),
  ADD COLUMN IF NOT EXISTS transcript text NULL,
  ADD COLUMN IF NOT EXISTS metadata jsonb NULL;

CREATE INDEX IF NOT EXISTS bob_closed_items_skill_cefr_idx
  ON bob_closed_items (skill, cefr_level, status)
  WHERE skill IS NOT NULL;

UPDATE bob_closed_items
SET skill = 'listening'
WHERE framework = 'toefl' AND exam_part = 'listen_choose_response'
  AND skill IS NULL;

INSERT INTO bob_closed_items (
  framework, exam_part, skill, cefr_level, variant_id,
  stimulus_audio_url, transcript, question, options, correct_key,
  explanation, source, status, metadata
) VALUES

(
  'cefr', 'assessment_listening', 'listening', 'a1', 'al-a1-01',
  '/listening/assessment/a1/al-a1-01.mp3',
  'Hi! My name is Tom. I am eight years old. I have a cat. Her name is Mimi. She is white and very small.',
  'How old is Tom?',
  '[{"key":"A","label":"Six"},{"key":"B","label":"Eight"},{"key":"C","label":"Ten"},{"key":"D","label":"Five"}]'::jsonb,
  'B',
  'Tom says "I am eight years old."',
  'generated_then_curated',
  'enabled',
  '{"topic":"personal_intro","voice":"child_male","duration_estimate":8}'::jsonb
),
(
  'cefr', 'assessment_listening', 'listening', 'a1', 'al-a1-02',
  '/listening/assessment/a1/al-a1-02.mp3',
  'Look at the picture. It is a dog. The dog is brown. It is big. It is playing in the garden.',
  'What colour is the dog?',
  '[{"key":"A","label":"Black"},{"key":"B","label":"White"},{"key":"C","label":"Brown"},{"key":"D","label":"Yellow"}]'::jsonb,
  'C',
  'The speaker says "The dog is brown."',
  'generated_then_curated',
  'enabled',
  '{"topic":"animals_colours","voice":"child_female","duration_estimate":9}'::jsonb
),
(
  'cefr', 'assessment_listening', 'listening', 'a1', 'al-a1-03',
  '/listening/assessment/a1/al-a1-03.mp3',
  'I go to school every day. My school starts at nine o''clock. I like drawing and music. My favourite food is pizza.',
  'What time does school start?',
  '[{"key":"A","label":"Eight o''clock"},{"key":"B","label":"Nine o''clock"},{"key":"C","label":"Ten o''clock"},{"key":"D","label":"Seven o''clock"}]'::jsonb,
  'B',
  'The speaker says "My school starts at nine o''clock."',
  'generated_then_curated',
  'enabled',
  '{"topic":"school_routine","voice":"child_female","duration_estimate":10}'::jsonb
),
(
  'cefr', 'assessment_listening', 'listening', 'a1', 'al-a1-04',
  '/listening/assessment/a1/al-a1-04.mp3',
  'This is my family. My mum is tall. My dad has got glasses. I have one brother. His name is Jack.',
  'How many brothers does the speaker have?',
  '[{"key":"A","label":"Two"},{"key":"B","label":"Three"},{"key":"C","label":"One"},{"key":"D","label":"None"}]'::jsonb,
  'C',
  'The speaker says "I have one brother."',
  'generated_then_curated',
  'enabled',
  '{"topic":"family","voice":"child_male","duration_estimate":9}'::jsonb
),
(
  'cefr', 'assessment_listening', 'listening', 'a1', 'al-a1-05',
  '/listening/assessment/a1/al-a1-05.mp3',
  'It is Monday. The weather is sunny today. I want to play football with my friends in the park after school.',
  'What day is it?',
  '[{"key":"A","label":"Tuesday"},{"key":"B","label":"Sunday"},{"key":"C","label":"Friday"},{"key":"D","label":"Monday"}]'::jsonb,
  'D',
  'The speaker says "It is Monday."',
  'generated_then_curated',
  'enabled',
  '{"topic":"days_weather","voice":"child_male","duration_estimate":10}'::jsonb
),
(
  'cefr', 'assessment_listening', 'listening', 'a1', 'al-a1-06',
  '/listening/assessment/a1/al-a1-06.mp3',
  'I live in a small house. There are four rooms: a kitchen, a living room, and two bedrooms. We have a garden with flowers.',
  'How many bedrooms are in the house?',
  '[{"key":"A","label":"One"},{"key":"B","label":"Three"},{"key":"C","label":"Two"},{"key":"D","label":"Four"}]'::jsonb,
  'C',
  'The speaker says "two bedrooms."',
  'generated_then_curated',
  'enabled',
  '{"topic":"home","voice":"child_female","duration_estimate":10}'::jsonb
),
(
  'cefr', 'assessment_listening', 'listening', 'a1', 'al-a1-07',
  '/listening/assessment/a1/al-a1-07.mp3',
  'My birthday is in July. I am going to have a party. My mum will make a chocolate cake. I love chocolate!',
  'What kind of cake will the speaker have?',
  '[{"key":"A","label":"Vanilla"},{"key":"B","label":"Strawberry"},{"key":"C","label":"Lemon"},{"key":"D","label":"Chocolate"}]'::jsonb,
  'D',
  'The speaker says "My mum will make a chocolate cake."',
  'generated_then_curated',
  'enabled',
  '{"topic":"birthday","voice":"child_female","duration_estimate":10}'::jsonb
),
(
  'cefr', 'assessment_listening', 'listening', 'a1', 'al-a1-08',
  '/listening/assessment/a1/al-a1-08.mp3',
  'I have got a red pencil case. Inside there are six pencils, a rubber, and a ruler. I always take it to school.',
  'What colour is the pencil case?',
  '[{"key":"A","label":"Blue"},{"key":"B","label":"Green"},{"key":"C","label":"Red"},{"key":"D","label":"Yellow"}]'::jsonb,
  'C',
  'The speaker says "I have got a red pencil case."',
  'generated_then_curated',
  'enabled',
  '{"topic":"school_objects","voice":"child_male","duration_estimate":9}'::jsonb
),

(
  'cefr', 'assessment_listening', 'listening', 'a2', 'al-a2-01',
  '/listening/assessment/a2/al-a2-01.mp3',
  'Good morning! Welcome to Green Park Zoo. Today we have a special event at two thirty in the afternoon. You can feed the penguins near the lake. Children under twelve must be with an adult.',
  'What time is the special event?',
  '[{"key":"A","label":"Two o''clock"},{"key":"B","label":"Half past two"},{"key":"C","label":"Three o''clock"},{"key":"D","label":"Half past three"}]'::jsonb,
  'B',
  'The announcement says "at two thirty in the afternoon."',
  'generated_then_curated',
  'enabled',
  '{"topic":"announcements","voice":"adult_female","duration_estimate":15}'::jsonb
),
(
  'cefr', 'assessment_listening', 'listening', 'a2', 'al-a2-02',
  '/listening/assessment/a2/al-a2-02.mp3',
  'Maria loves cooking. Last weekend she made pasta for her family. She used tomatoes, cheese, and basil from the garden. Her mum said it was delicious.',
  'Where did Maria get the basil?',
  '[{"key":"A","label":"From the supermarket"},{"key":"B","label":"From a friend"},{"key":"C","label":"From the garden"},{"key":"D","label":"From a restaurant"}]'::jsonb,
  'C',
  'The text says "basil from the garden."',
  'generated_then_curated',
  'enabled',
  '{"topic":"cooking_food","voice":"adult_female","duration_estimate":13}'::jsonb
),
(
  'cefr', 'assessment_listening', 'listening', 'a2', 'al-a2-03',
  '/listening/assessment/a2/al-a2-03.mp3',
  'Hi, this is a message for James. Your dentist appointment is on Thursday at four fifteen. Please call us if you need to change the time. The number is 0800 234 567.',
  'What day is James''s appointment?',
  '[{"key":"A","label":"Tuesday"},{"key":"B","label":"Wednesday"},{"key":"C","label":"Thursday"},{"key":"D","label":"Friday"}]'::jsonb,
  'C',
  'The message says "on Thursday at four fifteen."',
  'generated_then_curated',
  'enabled',
  '{"topic":"appointments","voice":"adult_male","duration_estimate":13}'::jsonb
),
(
  'cefr', 'assessment_listening', 'listening', 'a2', 'al-a2-04',
  '/listening/assessment/a2/al-a2-04.mp3',
  'Sofia and her brother went to the cinema last Saturday. They wanted to see the action film but it was sold out. They bought tickets for the comedy instead and really enjoyed it.',
  'Why did Sofia and her brother NOT watch the action film?',
  '[{"key":"A","label":"They didn''t like action films"},{"key":"B","label":"It was too expensive"},{"key":"C","label":"It was sold out"},{"key":"D","label":"It started too late"}]'::jsonb,
  'C',
  'The text says "it was sold out."',
  'generated_then_curated',
  'enabled',
  '{"topic":"leisure_cinema","voice":"teenager_female","duration_estimate":14}'::jsonb
),
(
  'cefr', 'assessment_listening', 'listening', 'a2', 'al-a2-05',
  '/listening/assessment/a2/al-a2-05.mp3',
  'This is a message from Westfield Library. The books you ordered have arrived. You can collect them from Monday to Friday between nine and six. Please bring your library card.',
  'When can you collect the books?',
  '[{"key":"A","label":"Seven days a week"},{"key":"B","label":"Monday to Friday"},{"key":"C","label":"Weekends only"},{"key":"D","label":"Monday to Saturday"}]'::jsonb,
  'B',
  'The message says "Monday to Friday."',
  'generated_then_curated',
  'enabled',
  '{"topic":"library_messages","voice":"adult_female","duration_estimate":13}'::jsonb
),
(
  'cefr', 'assessment_listening', 'listening', 'a2', 'al-a2-06',
  '/listening/assessment/a2/al-a2-06.mp3',
  'Jake is talking about his holiday. He went to Portugal with his parents and sister. It was very hot — about thirty-five degrees. They swam in the sea every day and ate lots of seafood.',
  'Who did Jake go on holiday with?',
  '[{"key":"A","label":"Friends"},{"key":"B","label":"His parents only"},{"key":"C","label":"His parents and sister"},{"key":"D","label":"His grandparents"}]'::jsonb,
  'C',
  'Jake says "with his parents and sister."',
  'generated_then_curated',
  'enabled',
  '{"topic":"holidays_travel","voice":"teenager_male","duration_estimate":14}'::jsonb
),
(
  'cefr', 'assessment_listening', 'listening', 'a2', 'al-a2-07',
  '/listening/assessment/a2/al-a2-07.mp3',
  'Train service update: the eleven forty-five to Manchester is delayed by approximately twenty minutes. Passengers are advised to wait on platform three. We apologise for any inconvenience.',
  'Which platform should passengers wait on?',
  '[{"key":"A","label":"Platform one"},{"key":"B","label":"Platform two"},{"key":"C","label":"Platform four"},{"key":"D","label":"Platform three"}]'::jsonb,
  'D',
  'The announcement says "wait on platform three."',
  'generated_then_curated',
  'enabled',
  '{"topic":"transport_announcements","voice":"adult_male","duration_estimate":13}'::jsonb
),
(
  'cefr', 'assessment_listening', 'listening', 'a2', 'al-a2-08',
  '/listening/assessment/a2/al-a2-08.mp3',
  'Emma started learning the guitar six months ago. She practises for half an hour every evening after dinner. Her teacher says she is making very good progress.',
  'How long has Emma been learning the guitar?',
  '[{"key":"A","label":"One year"},{"key":"B","label":"Three months"},{"key":"C","label":"Six months"},{"key":"D","label":"Two years"}]'::jsonb,
  'C',
  'The text says "six months ago."',
  'generated_then_curated',
  'enabled',
  '{"topic":"hobbies_music","voice":"adult_female","duration_estimate":12}'::jsonb
),

(
  'cefr', 'assessment_listening', 'listening', 'b1', 'al-b1-01',
  '/listening/assessment/b1/al-b1-01.mp3',
  'Good afternoon, and welcome to today''s science programme. Our guest, Dr Helena Moore, has spent the last ten years studying ocean pollution. Today she''ll be talking about how microplastics affect fish populations and what individuals can do to help reduce the problem.',
  'What is Dr Moore''s area of research?',
  '[{"key":"A","label":"Climate change"},{"key":"B","label":"Ocean pollution"},{"key":"C","label":"Marine biology"},{"key":"D","label":"Recycling technology"}]'::jsonb,
  'B',
  'The introduction says she has "spent the last ten years studying ocean pollution."',
  'generated_then_curated',
  'enabled',
  '{"topic":"science_environment","voice":"adult_female","duration_estimate":20}'::jsonb
),
(
  'cefr', 'assessment_listening', 'listening', 'b1', 'al-b1-02',
  '/listening/assessment/b1/al-b1-02.mp3',
  'Sarah and Tom are discussing their plans for the summer. Sarah wants to go travelling abroad, but Tom thinks they should save money this year because they''re planning to buy a flat next spring. In the end, they agree to take a short trip to Scotland instead.',
  'What do Sarah and Tom decide to do?',
  '[{"key":"A","label":"Travel abroad"},{"key":"B","label":"Stay at home"},{"key":"C","label":"Take a short trip to Scotland"},{"key":"D","label":"Buy a flat immediately"}]'::jsonb,
  'C',
  'They "agree to take a short trip to Scotland instead."',
  'generated_then_curated',
  'enabled',
  '{"topic":"plans_decisions","voice":"adult_mixed","duration_estimate":18}'::jsonb
),
(
  'cefr', 'assessment_listening', 'listening', 'b1', 'al-b1-03',
  '/listening/assessment/b1/al-b1-03.mp3',
  'In this interview, a young chef explains why she chose to open a vegetarian restaurant. She says that although her family thought it was too risky, she believed there was a real market for healthy, plant-based food in her city. After two years, the restaurant is fully booked every weekend.',
  'Why did the chef open a vegetarian restaurant?',
  '[{"key":"A","label":"Her family encouraged her"},{"key":"B","label":"She couldn''t find meat suppliers"},{"key":"C","label":"She saw a gap in the market"},{"key":"D","label":"She won a competition"}]'::jsonb,
  'C',
  'She says she "believed there was a real market for healthy, plant-based food."',
  'generated_then_curated',
  'enabled',
  '{"topic":"work_entrepreneurship","voice":"adult_female","duration_estimate":20}'::jsonb
),
(
  'cefr', 'assessment_listening', 'listening', 'b1', 'al-b1-04',
  '/listening/assessment/b1/al-b1-04.mp3',
  'Attention all passengers on flight BA 472 to Barcelona. Due to a technical issue, your departure has been moved from gate fourteen to gate twenty-two. Boarding will begin in thirty minutes. We apologise for this change and thank you for your patience.',
  'Why has the gate changed?',
  '[{"key":"A","label":"Security reasons"},{"key":"B","label":"A technical issue"},{"key":"C","label":"The plane arrived late"},{"key":"D","label":"Overcrowding at gate 14"}]'::jsonb,
  'B',
  'The announcement states "due to a technical issue."',
  'generated_then_curated',
  'enabled',
  '{"topic":"travel_announcements","voice":"adult_female","duration_estimate":17}'::jsonb
),
(
  'cefr', 'assessment_listening', 'listening', 'b1', 'al-b1-05',
  '/listening/assessment/b1/al-b1-05.mp3',
  'A student is asking her professor about the essay deadline. The professor explains that the original deadline of Friday has been extended to the following Monday because several students have been ill. However, anyone who submits by Friday will still get their work back sooner.',
  'What is the new essay deadline?',
  '[{"key":"A","label":"Friday"},{"key":"B","label":"The following Monday"},{"key":"C","label":"Wednesday"},{"key":"D","label":"The following Friday"}]'::jsonb,
  'B',
  'The professor says "extended to the following Monday."',
  'generated_then_curated',
  'enabled',
  '{"topic":"university_academic","voice":"adult_mixed","duration_estimate":18}'::jsonb
),
(
  'cefr', 'assessment_listening', 'listening', 'b1', 'al-b1-06',
  '/listening/assessment/b1/al-b1-06.mp3',
  'A radio presenter is talking about a new study on sleep. Scientists found that teenagers who sleep less than eight hours a night perform significantly worse in tests than those who sleep eight or more hours. The study also noted that screen use before bedtime is one of the main causes of poor sleep.',
  'According to the study, what is one cause of poor sleep in teenagers?',
  '[{"key":"A","label":"Eating too late"},{"key":"B","label":"Loud music"},{"key":"C","label":"Screen use before bedtime"},{"key":"D","label":"Exercising at night"}]'::jsonb,
  'C',
  'The study notes "screen use before bedtime is one of the main causes."',
  'generated_then_curated',
  'enabled',
  '{"topic":"health_science","voice":"adult_male","duration_estimate":19}'::jsonb
),
(
  'cefr', 'assessment_listening', 'listening', 'b1', 'al-b1-07',
  '/listening/assessment/b1/al-b1-07.mp3',
  'Marcus moved to a new city for his job last year. He found it hard at first because he didn''t know anyone and the commute was long. However, after joining a local football team, he quickly made friends and now says he loves living there.',
  'How did Marcus make friends in the new city?',
  '[{"key":"A","label":"Through his work colleagues"},{"key":"B","label":"By joining a football team"},{"key":"C","label":"At a language class"},{"key":"D","label":"Through social media"}]'::jsonb,
  'B',
  'Marcus made friends "after joining a local football team."',
  'generated_then_curated',
  'enabled',
  '{"topic":"social_life","voice":"adult_male","duration_estimate":17}'::jsonb
),
(
  'cefr', 'assessment_listening', 'listening', 'b1', 'al-b1-08',
  '/listening/assessment/b1/al-b1-08.mp3',
  'This is a voicemail from the doctor''s surgery. Mr Ahmed, we''re calling to confirm your appointment on the seventeenth of June at ten thirty in the morning. If you need to cancel or rearrange, please call before five o''clock today. Our number is 0207 541 3390.',
  'What should Mr Ahmed do if he cannot attend?',
  '[{"key":"A","label":"Email the surgery"},{"key":"B","label":"Call before five o''clock today"},{"key":"C","label":"Arrive early"},{"key":"D","label":"Send a message online"}]'::jsonb,
  'B',
  'The message says "please call before five o''clock today."',
  'generated_then_curated',
  'enabled',
  '{"topic":"voicemail_medical","voice":"adult_female","duration_estimate":17}'::jsonb
),

(
  'cefr', 'assessment_listening', 'listening', 'b2', 'al-b2-01',
  '/listening/assessment/b2/al-b2-01.mp3',
  'In this extract from a podcast on urban design, the architect argues that cities built around cars have created a public health crisis. She contends that the lack of walkable neighbourhoods and green spaces contributes not only to physical inactivity but also to higher rates of anxiety and depression among urban residents.',
  'What is the main argument the architect makes?',
  '[{"key":"A","label":"Cars should be banned from cities"},{"key":"B","label":"Car-centric design negatively affects health"},{"key":"C","label":"Green spaces are too expensive to build"},{"key":"D","label":"Urban residents prefer driving to walking"}]'::jsonb,
  'B',
  'Her argument is that car-centric design "contributes to physical inactivity" and mental health issues.',
  'generated_then_curated',
  'enabled',
  '{"topic":"urban_design_health","voice":"adult_female","duration_estimate":22}'::jsonb
),
(
  'cefr', 'assessment_listening', 'listening', 'b2', 'al-b2-02',
  '/listening/assessment/b2/al-b2-02.mp3',
  'During the interview, the historian explains that the popular perception of the Industrial Revolution as a period of unambiguous progress is, in fact, an oversimplification. While productivity increased dramatically, living standards for many workers actually deteriorated in the short term, a paradox that historians have debated for decades.',
  'What does the historian suggest about the Industrial Revolution?',
  '[{"key":"A","label":"It was entirely negative for workers"},{"key":"B","label":"Standard accounts of it are too simplistic"},{"key":"C","label":"Productivity did not actually increase"},{"key":"D","label":"Historians agree on its overall impact"}]'::jsonb,
  'B',
  'The historian says the popular perception "is an oversimplification."',
  'generated_then_curated',
  'enabled',
  '{"topic":"history_critical_thinking","voice":"adult_male","duration_estimate":22}'::jsonb
),
(
  'cefr', 'assessment_listening', 'listening', 'b2', 'al-b2-03',
  '/listening/assessment/b2/al-b2-03.mp3',
  'The panel discussion turns to the question of whether social media companies should be legally responsible for content posted by their users. One panellist argues that holding platforms liable would stifle free expression, while another contends that without accountability, misinformation will continue to flourish unchecked.',
  'What is the disagreement between the panellists?',
  '[{"key":"A","label":"Whether social media is harmful to teenagers"},{"key":"B","label":"Whether platforms should bear legal responsibility for user content"},{"key":"C","label":"Whether free expression should be limited"},{"key":"D","label":"Whether misinformation can be eliminated"}]'::jsonb,
  'B',
  'One argues against liability; the other argues for it — the core disagreement is legal responsibility.',
  'generated_then_curated',
  'enabled',
  '{"topic":"media_law_debate","voice":"adult_mixed","duration_estimate":22}'::jsonb
),
(
  'cefr', 'assessment_listening', 'listening', 'b2', 'al-b2-04',
  '/listening/assessment/b2/al-b2-04.mp3',
  'The economics professor explains that the term "stagflation" refers to the unusual combination of stagnant economic growth, high unemployment, and high inflation occurring simultaneously. She notes that conventional monetary policy tools often prove ineffective in this scenario because measures to combat inflation can worsen unemployment, and vice versa.',
  'Why is stagflation particularly challenging for policymakers?',
  '[{"key":"A","label":"It causes permanent economic damage"},{"key":"B","label":"Standard tools to fix one problem often worsen another"},{"key":"C","label":"It can only be solved by raising interest rates"},{"key":"D","label":"Unemployment is the hardest factor to measure"}]'::jsonb,
  'B',
  'She says measures for inflation "can worsen unemployment, and vice versa."',
  'generated_then_curated',
  'enabled',
  '{"topic":"economics_academic","voice":"adult_female","duration_estimate":23}'::jsonb
),
(
  'cefr', 'assessment_listening', 'listening', 'b2', 'al-b2-05',
  '/listening/assessment/b2/al-b2-05.mp3',
  'Novelist Patrick Chen is discussing his latest book in this radio interview. He reveals that the title is deliberately ambiguous — it can be read as either a statement of resignation or one of defiance, depending on the reader''s own emotional state at the time. He says he was inspired by the dual nature of grief.',
  'Why did Patrick Chen choose an ambiguous title?',
  '[{"key":"A","label":"To appeal to a wider audience"},{"key":"B","label":"Because he couldn''t decide on a single meaning"},{"key":"C","label":"To reflect how grief can be experienced differently"},{"key":"D","label":"Because his publisher suggested it"}]'::jsonb,
  'C',
  'He says the ambiguity reflects "the dual nature of grief" and the reader''s emotional state.',
  'generated_then_curated',
  'enabled',
  '{"topic":"literature_interview","voice":"adult_male","duration_estimate":22}'::jsonb
),
(
  'cefr', 'assessment_listening', 'listening', 'b2', 'al-b2-06',
  '/listening/assessment/b2/al-b2-06.mp3',
  'The documentary narrator explains that despite decades of international agreements, deforestation in tropical regions has accelerated rather than slowed. Scientists attribute this partly to the increased demand for agricultural land, but also to governance failures and insufficient funding for conservation programmes in developing nations.',
  'According to scientists, what are TWO reasons deforestation has continued?',
  '[{"key":"A","label":"Climate change and tourism"},{"key":"B","label":"Demand for agricultural land and governance failures"},{"key":"C","label":"Population growth and lack of education"},{"key":"D","label":"Industrial pollution and mining"}]'::jsonb,
  'B',
  'Scientists cite "demand for agricultural land" and "governance failures."',
  'generated_then_curated',
  'enabled',
  '{"topic":"environment_documentary","voice":"adult_male","duration_estimate":22}'::jsonb
),
(
  'cefr', 'assessment_listening', 'listening', 'b2', 'al-b2-07',
  '/listening/assessment/b2/al-b2-07.mp3',
  'A tech journalist is reviewing an artificial intelligence tool designed to detect plagiarism in academic writing. She notes that while the tool achieves high accuracy in identifying copied passages, it struggles with paraphrased content and has been criticised for generating false positives that unfairly penalise students.',
  'What is a key limitation of the AI plagiarism tool?',
  '[{"key":"A","label":"It is too slow to be useful"},{"key":"B","label":"It cannot detect copied passages"},{"key":"C","label":"It produces false positives with paraphrased content"},{"key":"D","label":"It is only available in English"}]'::jsonb,
  'C',
  'It "struggles with paraphrased content" and generates "false positives."',
  'generated_then_curated',
  'enabled',
  '{"topic":"technology_education","voice":"adult_female","duration_estimate":22}'::jsonb
),
(
  'cefr', 'assessment_listening', 'listening', 'b2', 'al-b2-08',
  '/listening/assessment/b2/al-b2-08.mp3',
  'The neuroscientist being interviewed explains that the human brain is remarkably adaptable — a property known as neuroplasticity. However, she cautions against the popular misconception that this means adults can learn any skill as easily as children can. While the brain does retain plasticity throughout life, the rate of change slows considerably after adolescence.',
  'What misconception does the neuroscientist address?',
  '[{"key":"A","label":"That neuroplasticity only exists in children"},{"key":"B","label":"That adults learn new skills as easily as children"},{"key":"C","label":"That the brain stops changing after age thirty"},{"key":"D","label":"That intelligence is fixed at birth"}]'::jsonb,
  'B',
  'She cautions against "the misconception that this means adults can learn any skill as easily as children."',
  'generated_then_curated',
  'enabled',
  '{"topic":"neuroscience_interview","voice":"adult_female","duration_estimate":23}'::jsonb
)

ON CONFLICT (framework, exam_part, cefr_level, variant_id) DO NOTHING;

COMMIT;
