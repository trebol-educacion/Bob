BEGIN;

INSERT INTO bob_closed_items (
  framework, exam_part, skill, cefr_level, variant_id,
  stimulus_audio_url, transcript, question, options, correct_key,
  explanation, source, status, metadata
) VALUES

(
  'cambridge', 'pet_listening_part2', 'listening', 'b1', 'pl-p2-01',
  '/pet-listening-part2/pl-p2-01.mp3',
  'Good morning, everyone. I''m here today to talk about my experience volunteering at the local animal shelter last summer. When I first arrived, I expected to spend most of my time walking dogs, but actually the shelter needed help with something completely different — they asked me to redesign their website so more people could find animals to adopt. It took about three weeks, and in the end they saw a forty percent increase in adoption enquiries. I''d definitely recommend volunteering there.',
  'What did the speaker mainly do at the animal shelter?',
  '[{"key":"A","label":"Walked dogs every day"},{"key":"B","label":"Updated the shelter website"},{"key":"C","label":"Looked after injured animals"},{"key":"D","label":"Trained new volunteers"}]'::jsonb,
  'B',
  'The speaker says the shelter asked her to redesign their website, not walk dogs as she had expected.',
  'generated_then_curated',
  'enabled',
  '{"topic":"volunteering","voice":"adult_female","estimated_seconds":22}'::jsonb
),

(
  'cambridge', 'pet_listening_part2', 'listening', 'b1', 'pl-p2-02',
  '/pet-listening-part2/pl-p2-02.mp3',
  'Hi, this is a message for Nathan. It''s Diane from the travel agency. I''m calling about your booking for the city tour next Saturday. Unfortunately the original morning departure at nine o''clock is now fully booked. We do have spaces on the afternoon tour at two o''clock and also one at four thirty. The tour itself lasts two hours regardless of which time you choose. Please call us back before five today to confirm.',
  'Why is Diane calling Nathan?',
  '[{"key":"A","label":"To cancel his booking entirely"},{"key":"B","label":"To tell him the tour has been shortened"},{"key":"C","label":"To offer him a different departure time"},{"key":"D","label":"To confirm his payment details"}]'::jsonb,
  'C',
  'The morning slot is full so Diane offers Nathan two alternative afternoon times.',
  'generated_then_curated',
  'enabled',
  '{"topic":"travel","voice":"adult_female","estimated_seconds":20}'::jsonb
),

(
  'cambridge', 'pet_listening_part2', 'listening', 'b1', 'pl-p2-03',
  '/pet-listening-part2/pl-p2-03.mp3',
  'A new report published this week suggests that teenagers who eat breakfast regularly perform better in morning classes than those who skip it. Researchers followed five hundred students for six months. They found that students who had breakfast showed improved concentration and scored on average twelve percent higher in tests taken before midday. Interestingly, the type of breakfast didn''t seem to matter much — even a small snack was enough to make a difference.',
  'What did the researchers find about breakfast?',
  '[{"key":"A","label":"Students who ate a large breakfast did best"},{"key":"B","label":"Skipping breakfast had no effect on test scores"},{"key":"C","label":"Even a small breakfast improved morning performance"},{"key":"D","label":"Benefits were only seen in afternoon lessons"}]'::jsonb,
  'C',
  'The report says even a small snack was enough, so the size of breakfast did not matter — just eating something helped.',
  'generated_then_curated',
  'enabled',
  '{"topic":"health_education","voice":"adult_male","estimated_seconds":23}'::jsonb
),

(
  'cambridge', 'pet_listening_part2', 'listening', 'b1', 'pl-p2-04',
  '/pet-listening-part2/pl-p2-04.mp3',
  'I started learning photography three years ago, and the biggest lesson I''ve learned is that expensive equipment doesn''t automatically make better photos. I spent ages saving up for a professional camera, but when I finally got it I realised my compositions weren''t improving at all. It was only when I joined a photography club and got feedback from other members that things started to click. The community and honest critique helped far more than any piece of kit.',
  'According to the speaker, what most improved their photography?',
  '[{"key":"A","label":"Buying a professional camera"},{"key":"B","label":"Watching online tutorials"},{"key":"C","label":"Practising alone every day"},{"key":"D","label":"Getting feedback from a photography club"}]'::jsonb,
  'D',
  'The speaker says joining a club and receiving honest critique helped far more than the new camera.',
  'generated_then_curated',
  'enabled',
  '{"topic":"hobbies","voice":"teenager_female","estimated_seconds":22}'::jsonb
),

(
  'cambridge', 'pet_listening_part2', 'listening', 'b1', 'pl-p2-05',
  '/pet-listening-part2/pl-p2-05.mp3',
  'Attention, shoppers. Westgate Shopping Centre will be closing earlier than usual this Sunday due to a staff training day. Shops will close at five o''clock instead of the normal eight o''clock. The food court, however, will remain open until six. Car park exits will be available until six thirty. We apologise for any inconvenience and look forward to welcoming you back next week during normal hours.',
  'Until what time will the food court be open this Sunday?',
  '[{"key":"A","label":"Five o''clock"},{"key":"B","label":"Six o''clock"},{"key":"C","label":"Six thirty"},{"key":"D","label":"Eight o''clock"}]'::jsonb,
  'B',
  'The announcement states the food court will remain open until six, one hour later than the shops.',
  'generated_then_curated',
  'enabled',
  '{"topic":"announcements","voice":"adult_female","estimated_seconds":19}'::jsonb
),

(
  'cambridge', 'pet_listening_part2', 'listening', 'b1', 'pl-p2-06',
  '/pet-listening-part2/pl-p2-06.mp3',
  'In this week''s environment segment, we''re looking at community gardens in urban areas. Researchers at Greenfield University interviewed residents living near community gardens and found that most people valued them primarily as a place to meet neighbours rather than for the food they produced. Several respondents also mentioned reduced stress levels. Only a small number said they visited mainly to grow their own vegetables.',
  'What did most residents value most about community gardens?',
  '[{"key":"A","label":"Growing their own food"},{"key":"B","label":"Reducing their stress levels"},{"key":"C","label":"Meeting their neighbours"},{"key":"D","label":"Improving the neighbourhood''s appearance"}]'::jsonb,
  'C',
  'The majority valued community gardens primarily as a place to meet neighbours, not mainly for food or stress reduction.',
  'generated_then_curated',
  'enabled',
  '{"topic":"environment_community","voice":"adult_male","estimated_seconds":21}'::jsonb
),

(
  'cambridge', 'pet_listening_part2', 'listening', 'b1', 'pl-p2-07',
  '/pet-listening-part2/pl-p2-07.mp3',
  'My parents think I should study medicine because there are always jobs, but honestly I find the sciences really hard. I''ve always been much better at languages and I love writing. My school careers advisor suggested journalism, which sounds exciting, but my mum says the industry is too unstable. I don''t know what to decide. I think I need more time to figure out what really motivates me before I commit to anything.',
  'What is the speaker''s main problem?',
  '[{"key":"A","label":"She is failing her science subjects"},{"key":"B","label":"She cannot find a careers advisor"},{"key":"C","label":"She is unsure which career path to choose"},{"key":"D","label":"Her parents want her to study journalism"}]'::jsonb,
  'C',
  'The speaker is torn between her parents'' preference for medicine and her own interest in languages and writing, and has not yet decided.',
  'generated_then_curated',
  'enabled',
  '{"topic":"work_career","voice":"teenager_female","estimated_seconds":22}'::jsonb
),

(
  'cambridge', 'pet_listening_part2', 'listening', 'b1', 'pl-p2-08',
  '/pet-listening-part2/pl-p2-08.mp3',
  'The school is pleased to announce that the summer fair will be held on the fourteenth of June this year, a week later than originally planned. This change was made because several key staff members will be away on the previously scheduled date. All the usual activities will be included: games, a food stall, a raffle, and live music from the school band. Tickets are available from the school office from Monday.',
  'Why has the date of the summer fair changed?',
  '[{"key":"A","label":"The venue was not available on the original date"},{"key":"B","label":"Some key staff will be absent on the original date"},{"key":"C","label":"The school band was not ready to perform"},{"key":"D","label":"Not enough tickets had been sold"}]'::jsonb,
  'B',
  'The announcement explicitly states the change was because several key staff members will be away.',
  'generated_then_curated',
  'enabled',
  '{"topic":"school_events","voice":"adult_female","estimated_seconds":21}'::jsonb
),

(
  'cambridge', 'pet_listening_part2', 'listening', 'b1', 'pl-p2-09',
  '/pet-listening-part2/pl-p2-09.mp3',
  'Technology has completely changed the way I cook. Before, I''d spend ages flicking through cookbooks and never being sure if a recipe would turn out well. Now I use a meal planning app that suggests recipes based on what''s already in my fridge. What I really appreciate is that it automatically generates a shopping list for any ingredients I''m missing. I save both time and money because I don''t buy things I don''t need.',
  'What does the speaker most appreciate about the meal planning app?',
  '[{"key":"A","label":"It recommends popular restaurants nearby"},{"key":"B","label":"It automatically creates a shopping list for missing items"},{"key":"C","label":"It teaches her new cooking techniques"},{"key":"D","label":"It stores all her favourite recipes"}]'::jsonb,
  'B',
  'The speaker specifically highlights the automatic shopping list as what she really appreciates.',
  'generated_then_curated',
  'enabled',
  '{"topic":"technology_food","voice":"adult_female","estimated_seconds":22}'::jsonb
),

(
  'cambridge', 'pet_listening_part2', 'listening', 'b1', 'pl-p2-10',
  '/pet-listening-part2/pl-p2-10.mp3',
  'Tomas moved to a new city for university last September. He found the first few weeks very difficult because he was used to a close-knit family environment and suddenly felt very isolated. He thought about going home but decided to push through. By November, after joining the university running club, he had made a solid group of friends and now says he wouldn''t change the experience for anything. He believes the challenge made him much more independent.',
  'How did Tomas feel during his first weeks at university?',
  '[{"key":"A","label":"Excited to meet new people"},{"key":"B","label":"Lonely and isolated"},{"key":"C","label":"Bored by his course"},{"key":"D","label":"Unhappy with his accommodation"}]'::jsonb,
  'B',
  'Tomas suddenly felt very isolated having left his close family environment behind.',
  'generated_then_curated',
  'enabled',
  '{"topic":"family_independence","voice":"teenager_male","estimated_seconds":22}'::jsonb
)

ON CONFLICT (framework, exam_part, cefr_level, variant_id) DO NOTHING;

UPDATE bob_prompts
SET
  status = 'enabled',
  label = 'Listening Part 2 — Multiple Choice',
  description = 'Listen to short talks and pick the right answer.'
WHERE prompt_key = 'cambridge_pet_listening_part2_b1_generation';

COMMIT;
