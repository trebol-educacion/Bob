BEGIN;

-- Reading assessment items for bob-skill-first-assessment B14.
-- 8 items per CEFR level (a1, a2, b1, b2) = 32 items total.
-- No audio required. stimulus_text contains the reading passage.

INSERT INTO bob_closed_items (
  framework, exam_part, skill, cefr_level, variant_id,
  stimulus_audio_url, stimulus_text, question, options, correct_key,
  explanation, source, status, metadata
) VALUES

-- A1 items (8)
(
  'cefr', 'assessment_reading', 'reading', 'a1', 'ar-a1-01', NULL,
  'My name is Lucy. I am nine years old. I have a dog. His name is Max. He is big and brown. I walk him every morning before school.',
  'What is the name of Lucy''s dog?',
  '[{"key":"A","label":"Lucy"},{"key":"B","label":"Max"},{"key":"C","label":"Rex"},{"key":"D","label":"Tom"}]'::jsonb,
  'B', 'Lucy says "His name is Max."', 'generated_then_curated', 'enabled',
  '{"topic":"pets_family","genre":"personal_description","estimated_seconds":30}'::jsonb
),
(
  'cefr', 'assessment_reading', 'reading', 'a1', 'ar-a1-02', NULL,
  'Library notice: The library is open Monday to Friday from 9 am to 5 pm. It is closed on Saturday and Sunday. Children under 12 need a parent with them.',
  'When is the library closed?',
  '[{"key":"A","label":"Monday"},{"key":"B","label":"Friday"},{"key":"C","label":"Saturday and Sunday"},{"key":"D","label":"Every morning"}]'::jsonb,
  'C', 'The notice says "It is closed on Saturday and Sunday."', 'generated_then_curated', 'enabled',
  '{"topic":"public_signs","genre":"notice","estimated_seconds":30}'::jsonb
),
(
  'cefr', 'assessment_reading', 'reading', 'a1', 'ar-a1-03', NULL,
  'Hi Tom! I am at the park. The weather is sunny and warm. Come and play football with me! — Sam',
  'Where is Sam?',
  '[{"key":"A","label":"At school"},{"key":"B","label":"At home"},{"key":"C","label":"At the park"},{"key":"D","label":"At the shop"}]'::jsonb,
  'C', 'Sam writes "I am at the park."', 'generated_then_curated', 'enabled',
  '{"topic":"free_time","genre":"short_message","estimated_seconds":25}'::jsonb
),
(
  'cefr', 'assessment_reading', 'reading', 'a1', 'ar-a1-04', NULL,
  'Anna likes fruit. She eats an apple every day. Her favourite fruit is a mango. She does not like oranges.',
  'What is Anna''s favourite fruit?',
  '[{"key":"A","label":"Apple"},{"key":"B","label":"Orange"},{"key":"C","label":"Banana"},{"key":"D","label":"Mango"}]'::jsonb,
  'D', 'The text says "Her favourite fruit is a mango."', 'generated_then_curated', 'enabled',
  '{"topic":"food","genre":"personal_description","estimated_seconds":25}'::jsonb
),
(
  'cefr', 'assessment_reading', 'reading', 'a1', 'ar-a1-05', NULL,
  'SCHOOL CAFÉ — Open: 12:00–14:00 — Hot meals: £2.50 — Sandwiches: £1.20 — Drinks: 50p — No food outside the café, please.',
  'How much does a hot meal cost?',
  '[{"key":"A","label":"50p"},{"key":"B","label":"£1.20"},{"key":"C","label":"£2.50"},{"key":"D","label":"£3.00"}]'::jsonb,
  'C', 'The sign says "Hot meals: £2.50."', 'generated_then_curated', 'enabled',
  '{"topic":"school_life","genre":"sign","estimated_seconds":25}'::jsonb
),
(
  'cefr', 'assessment_reading', 'reading', 'a1', 'ar-a1-06', NULL,
  'Dear Mum, I am having a great time at camp. We swim every afternoon. The food is good. I miss you. Love, Jake',
  'What does Jake do every afternoon at camp?',
  '[{"key":"A","label":"Play football"},{"key":"B","label":"Swim"},{"key":"C","label":"Cook"},{"key":"D","label":"Sleep"}]'::jsonb,
  'B', 'Jake writes "We swim every afternoon."', 'generated_then_curated', 'enabled',
  '{"topic":"holidays","genre":"letter","estimated_seconds":30}'::jsonb
),
(
  'cefr', 'assessment_reading', 'reading', 'a1', 'ar-a1-07', NULL,
  'Pets for sale! We have rabbits, hamsters and fish. All animals are healthy and friendly. Come to 14 Green Street. Open 10 am – 6 pm daily.',
  'Which animal is NOT mentioned?',
  '[{"key":"A","label":"Rabbit"},{"key":"B","label":"Hamster"},{"key":"C","label":"Cat"},{"key":"D","label":"Fish"}]'::jsonb,
  'C', 'The advert lists rabbits, hamsters and fish. Cats are not mentioned.', 'generated_then_curated', 'enabled',
  '{"topic":"animals","genre":"advert","estimated_seconds":30}'::jsonb
),
(
  'cefr', 'assessment_reading', 'reading', 'a1', 'ar-a1-08', NULL,
  'Today is Monday. School starts at 8:30. After school I go to football practice. It finishes at 5 o''clock. Then I do my homework.',
  'What does the writer do after football practice?',
  '[{"key":"A","label":"Go to school"},{"key":"B","label":"Have dinner"},{"key":"C","label":"Do homework"},{"key":"D","label":"Watch TV"}]'::jsonb,
  'C', 'The text says "Then I do my homework."', 'generated_then_curated', 'enabled',
  '{"topic":"daily_routine","genre":"diary","estimated_seconds":30}'::jsonb
),

-- A2 items (8)
(
  'cefr', 'assessment_reading', 'reading', 'a2', 'ar-a2-01', NULL,
  'Maria is 13 years old and lives in Madrid. She loves reading and goes to the library every Saturday. Last week she borrowed a mystery novel. She read the whole book in two days because she found it very exciting.',
  'Why did Maria finish the book so quickly?',
  '[{"key":"A","label":"The library closed"},{"key":"B","label":"Her friend wanted it"},{"key":"C","label":"She found it very exciting"},{"key":"D","label":"It was very short"}]'::jsonb,
  'C', 'The text says she read it quickly "because she found it very exciting."', 'generated_then_curated', 'enabled',
  '{"topic":"hobbies_reading","genre":"personal_description","estimated_seconds":40}'::jsonb
),
(
  'cefr', 'assessment_reading', 'reading', 'a2', 'ar-a2-02', NULL,
  'NOTICE — Swimming pool rules: No running near the pool. Shower before entering the water. Children under 8 must be with an adult. The pool closes at 9 pm on weekdays and 7 pm on weekends.',
  'What time does the pool close on Saturdays?',
  '[{"key":"A","label":"8 pm"},{"key":"B","label":"9 pm"},{"key":"C","label":"7 pm"},{"key":"D","label":"10 pm"}]'::jsonb,
  'C', 'The notice says the pool closes "7 pm on weekends." Saturday is a weekend day.', 'generated_then_curated', 'enabled',
  '{"topic":"sports_facilities","genre":"notice","estimated_seconds":35}'::jsonb
),
(
  'cefr', 'assessment_reading', 'reading', 'a2', 'ar-a2-03', NULL,
  'Hi Carla, I''m writing to invite you to my birthday party! It''s on Saturday 15th June at my house, starting at 3 pm. Please bring your swimming costume because we''ll use the garden pool. Hope you can come! — Lily',
  'What should Carla bring to the party?',
  '[{"key":"A","label":"A cake"},{"key":"B","label":"A swimming costume"},{"key":"C","label":"A towel"},{"key":"D","label":"A present"}]'::jsonb,
  'B', 'Lily says "Please bring your swimming costume."', 'generated_then_curated', 'enabled',
  '{"topic":"social_invitations","genre":"email","estimated_seconds":35}'::jsonb
),
(
  'cefr', 'assessment_reading', 'reading', 'a2', 'ar-a2-04', NULL,
  'Omar started learning the guitar six months ago. He practises for 30 minutes every evening. His teacher says he is making very good progress. Omar wants to play in the school concert next year.',
  'What is Omar''s goal?',
  '[{"key":"A","label":"To buy a new guitar"},{"key":"B","label":"To become a music teacher"},{"key":"C","label":"To play in the school concert"},{"key":"D","label":"To practise for an hour a day"}]'::jsonb,
  'C', 'The text says "Omar wants to play in the school concert next year."', 'generated_then_curated', 'enabled',
  '{"topic":"music_hobbies","genre":"personal_description","estimated_seconds":35}'::jsonb
),
(
  'cefr', 'assessment_reading', 'reading', 'a2', 'ar-a2-05', NULL,
  'Lost cat! Our grey and white cat, Misty, went missing on Tuesday evening near Pine Avenue. She is three years old and very friendly. If you see her, please call 07700 900123. Reward offered.',
  'What colour is Misty?',
  '[{"key":"A","label":"Black and white"},{"key":"B","label":"Orange"},{"key":"C","label":"Grey and white"},{"key":"D","label":"Brown"}]'::jsonb,
  'C', 'The notice says "Our grey and white cat, Misty."', 'generated_then_curated', 'enabled',
  '{"topic":"community_notices","genre":"notice","estimated_seconds":35}'::jsonb
),
(
  'cefr', 'assessment_reading', 'reading', 'a2', 'ar-a2-06', NULL,
  'The school trip to the science museum is on Friday 20th March. Students must arrive at school by 8:15 am. The coach leaves at 8:30. Please bring a packed lunch and wear comfortable shoes. No electronic devices.',
  'What time does the coach leave?',
  '[{"key":"A","label":"8:00 am"},{"key":"B","label":"8:15 am"},{"key":"C","label":"8:30 am"},{"key":"D","label":"9:00 am"}]'::jsonb,
  'C', 'The notice says "The coach leaves at 8:30."', 'generated_then_curated', 'enabled',
  '{"topic":"school_trips","genre":"information_text","estimated_seconds":35}'::jsonb
),
(
  'cefr', 'assessment_reading', 'reading', 'a2', 'ar-a2-07', NULL,
  'My cousin Leo moved to our city last month. He goes to my school now. At first he was nervous because he didn''t know anyone, but now he has made several new friends and really enjoys his classes.',
  'How does Leo feel now?',
  '[{"key":"A","label":"Nervous"},{"key":"B","label":"Bored"},{"key":"C","label":"Happy"},{"key":"D","label":"Tired"}]'::jsonb,
  'C', 'The text says Leo "really enjoys his classes" and has made new friends — he feels happy.', 'generated_then_curated', 'enabled',
  '{"topic":"school_social","genre":"personal_narrative","estimated_seconds":40}'::jsonb
),
(
  'cefr', 'assessment_reading', 'reading', 'a2', 'ar-a2-08', NULL,
  'FOR SALE: Mountain bike. Good condition. Used for one year. Suitable for ages 12–16. Price: £80 (was £150). Collection only. Call Dan on 07700 555321.',
  'Why is the price reduced?',
  '[{"key":"A","label":"The bike is broken"},{"key":"B","label":"Dan needs the money quickly"},{"key":"C","label":"The advert does not say"},{"key":"D","label":"The bike is too small"}]'::jsonb,
  'C', 'The advert gives no reason for the reduction — the text does not say.', 'generated_then_curated', 'enabled',
  '{"topic":"buying_selling","genre":"advert","estimated_seconds":35}'::jsonb
),

-- B1 items (8)
(
  'cefr', 'assessment_reading', 'reading', 'b1', 'ar-b1-01', NULL,
  'Although Fatima had studied hard for her chemistry exam, she felt uncertain as she walked into the hall. The questions were harder than expected, and she spent too long on the first section. By the time she reached the last part, she only had ten minutes left. She handed in her paper feeling disappointed.',
  'Why was Fatima disappointed?',
  '[{"key":"A","label":"She forgot to study"},{"key":"B","label":"She ran out of time"},{"key":"C","label":"The exam was cancelled"},{"key":"D","label":"Her teacher was not there"}]'::jsonb,
  'B', 'Fatima "spent too long on the first section" and had only ten minutes for the last part — she ran out of time.', 'generated_then_curated', 'enabled',
  '{"topic":"school_exams","genre":"narrative","estimated_seconds":50}'::jsonb
),
(
  'cefr', 'assessment_reading', 'reading', 'b1', 'ar-b1-02', NULL,
  'IMPORTANT NOTICE — The school canteen will be closed for refurbishment from Monday 3rd to Friday 14th June. During this period, students are welcome to use the outdoor picnic area. Hot drinks will be available from a temporary kiosk near the main entrance. We apologise for any inconvenience.',
  'What will students be able to buy during the closure?',
  '[{"key":"A","label":"Hot meals"},{"key":"B","label":"Sandwiches"},{"key":"C","label":"Hot drinks"},{"key":"D","label":"Nothing"}]'::jsonb,
  'C', 'The notice says "Hot drinks will be available from a temporary kiosk."', 'generated_then_curated', 'enabled',
  '{"topic":"school_facilities","genre":"notice","estimated_seconds":45}'::jsonb
),
(
  'cefr', 'assessment_reading', 'reading', 'b1', 'ar-b1-03', NULL,
  'Hi Sadia, I know you said you were thinking about joining the drama club. I went to their first rehearsal last week and it was brilliant — the director is really encouraging and the other members are so friendly. The only downside is that rehearsals are on Thursday evenings, which means missing football training. Let me know what you decide! — Rosa',
  'What is the disadvantage of the drama club, according to Rosa?',
  '[{"key":"A","label":"The director is strict"},{"key":"B","label":"The members are unfriendly"},{"key":"C","label":"It clashes with football training"},{"key":"D","label":"It is too expensive"}]'::jsonb,
  'C', 'Rosa says "rehearsals are on Thursday evenings, which means missing football training."', 'generated_then_curated', 'enabled',
  '{"topic":"extracurricular","genre":"email","estimated_seconds":50}'::jsonb
),
(
  'cefr', 'assessment_reading', 'reading', 'b1', 'ar-b1-04', NULL,
  'Many teenagers report feeling stressed about their future careers. A recent survey found that 68% of 15-year-olds worry about whether they will find a good job. Career advisers suggest that young people should explore their interests rather than focus on salary, as job satisfaction is closely linked to long-term wellbeing.',
  'What do career advisers recommend?',
  '[{"key":"A","label":"Getting a high salary"},{"key":"B","label":"Focusing on maths and science"},{"key":"C","label":"Exploring personal interests"},{"key":"D","label":"Choosing a job early"}]'::jsonb,
  'C', 'Advisers suggest "young people should explore their interests."', 'generated_then_curated', 'enabled',
  '{"topic":"careers_future","genre":"article","estimated_seconds":50}'::jsonb
),
(
  'cefr', 'assessment_reading', 'reading', 'b1', 'ar-b1-05', NULL,
  'The village of Ashton is organising its annual summer fair on Saturday 8th July from 10 am to 6 pm on the village green. This year there will be a talent show, craft stalls and a food market. All proceeds will go to the local animal shelter. Volunteers to help set up on Friday afternoon are welcome.',
  'What will happen to the money raised at the fair?',
  '[{"key":"A","label":"It will pay for the talent show"},{"key":"B","label":"It will go to the local animal shelter"},{"key":"C","label":"It will fund the craft stalls"},{"key":"D","label":"It will be shared among volunteers"}]'::jsonb,
  'B', 'The notice says "All proceeds will go to the local animal shelter."', 'generated_then_curated', 'enabled',
  '{"topic":"community_events","genre":"announcement","estimated_seconds":45}'::jsonb
),
(
  'cefr', 'assessment_reading', 'reading', 'b1', 'ar-b1-06', NULL,
  'Kieran had always dreamed of travelling, but money was a constant obstacle. When he saw an advert for a paid work-exchange programme in Japan, he applied immediately. Six months later, he was teaching English in a small mountain town, slowly building the savings that would fund his next adventure.',
  'What is suggested about Kieran''s financial situation?',
  '[{"key":"A","label":"He is very wealthy"},{"key":"B","label":"He cannot afford to travel without working"},{"key":"C","label":"He has a well-paid job at home"},{"key":"D","label":"His family pays for his trips"}]'::jsonb,
  'B', 'The text says "money was a constant obstacle," implying he needs to earn money to travel.', 'generated_then_curated', 'enabled',
  '{"topic":"travel_work","genre":"narrative","estimated_seconds":50}'::jsonb
),
(
  'cefr', 'assessment_reading', 'reading', 'b1', 'ar-b1-07', NULL,
  'Research shows that students who sleep fewer than eight hours a night are likely to perform worse in tests and have difficulty concentrating in class. Despite this, many teenagers go to bed after midnight due to homework, social media, or part-time jobs. Experts recommend setting a regular sleep schedule as the most effective solution.',
  'According to the text, what causes many teenagers to sleep late?',
  '[{"key":"A","label":"They enjoy night-time activities"},{"key":"B","label":"Their parents allow it"},{"key":"C","label":"Homework, social media or part-time jobs"},{"key":"D","label":"School starts too early"}]'::jsonb,
  'C', 'The text says teenagers go to bed late "due to homework, social media, or part-time jobs."', 'generated_then_curated', 'enabled',
  '{"topic":"health_sleep","genre":"article","estimated_seconds":50}'::jsonb
),
(
  'cefr', 'assessment_reading', 'reading', 'b1', 'ar-b1-08', NULL,
  'Dear Mr Collins, I am writing to apply for the part-time shop assistant position advertised on your website. I am 17 years old and currently studying for my GCSEs. I have previous experience working in my uncle''s bakery every Saturday and I am available on weekends. I look forward to hearing from you. Yours sincerely, Priya Shah',
  'What relevant experience does Priya mention?',
  '[{"key":"A","label":"Working in a school canteen"},{"key":"B","label":"Studying business at college"},{"key":"C","label":"Working in her uncle''s bakery"},{"key":"D","label":"Helping in a clothes shop"}]'::jsonb,
  'C', 'Priya says "I have previous experience working in my uncle''s bakery."', 'generated_then_curated', 'enabled',
  '{"topic":"job_applications","genre":"formal_letter","estimated_seconds":50}'::jsonb
),

-- B2 items (8)
(
  'cefr', 'assessment_reading', 'reading', 'b2', 'ar-b2-01', NULL,
  'While many people assume that multitasking increases productivity, cognitive science tells a different story. Studies consistently show that switching rapidly between tasks reduces the quality of work and increases errors. The human brain, it turns out, is not designed to process multiple streams of complex information simultaneously. What we call "multitasking" is, in reality, rapid task-switching — and each switch comes at a cognitive cost.',
  'What does the author suggest about multitasking?',
  '[{"key":"A","label":"It is only effective for simple tasks"},{"key":"B","label":"It genuinely improves productivity"},{"key":"C","label":"It is a myth that reduces work quality"},{"key":"D","label":"It is useful when tasks are similar"}]'::jsonb,
  'C', 'The text argues multitasking "reduces the quality of work" and is actually rapid task-switching — a myth.', 'generated_then_curated', 'enabled',
  '{"topic":"psychology_cognition","genre":"academic_article","estimated_seconds":60}'::jsonb
),
(
  'cefr', 'assessment_reading', 'reading', 'b2', 'ar-b2-02', NULL,
  'The rapid expansion of short-term rental platforms has transformed urban housing markets in ways that are still poorly understood. Landlords who convert long-term rentals into tourist accommodation can earn significantly more, but the effect on local residents — particularly those on lower incomes — can be severe. Several cities have introduced legislation to limit the number of nights properties can be rented out, though enforcement remains inconsistent.',
  'What concern does the text raise about short-term rental platforms?',
  '[{"key":"A","label":"They are too expensive for tourists"},{"key":"B","label":"They reduce housing availability for local residents"},{"key":"C","label":"Landlords earn less money than before"},{"key":"D","label":"They are impossible to regulate"}]'::jsonb,
  'B', 'The text highlights the "severe" effect on local residents, especially low-income ones, as landlords shift to tourist rentals.', 'generated_then_curated', 'enabled',
  '{"topic":"urban_society","genre":"opinion_text","estimated_seconds":60}'::jsonb
),
(
  'cefr', 'assessment_reading', 'reading', 'b2', 'ar-b2-03', NULL,
  'Dear Editor, I am writing in response to last week''s editorial, which argued that social media has been unambiguously harmful for young people. While I share the concern about screen time, I believe the picture is more nuanced. For marginalised teenagers — those who are isolated in their communities due to geography, disability or identity — online spaces can provide a vital sense of belonging. To condemn these platforms outright seems to ignore this reality.',
  'What is the writer''s main point?',
  '[{"key":"A","label":"Social media is always beneficial for teenagers"},{"key":"B","label":"The negative effects of social media are exaggerated"},{"key":"C","label":"The impact of social media depends on the individual''s situation"},{"key":"D","label":"Teenagers should use social media less"}]'::jsonb,
  'C', 'The writer argues the picture is "nuanced" and that for some marginalised teens, social media provides belonging — the impact depends on context.', 'generated_then_curated', 'enabled',
  '{"topic":"social_media","genre":"letter_to_editor","estimated_seconds":65}'::jsonb
),
(
  'cefr', 'assessment_reading', 'reading', 'b2', 'ar-b2-04', NULL,
  'IMPORTANT NOTICE TO ALL EMPLOYEES — Following the annual IT security audit, the company has introduced mandatory two-factor authentication for all internal systems with effect from 1st September. Staff who have not completed the setup by this date will be temporarily unable to access their accounts until IT support has verified their identity in person. Please contact helpdesk@company.com for assistance.',
  'What will happen to employees who do not set up two-factor authentication by 1st September?',
  '[{"key":"A","label":"They will be dismissed"},{"key":"B","label":"Their accounts will be permanently deleted"},{"key":"C","label":"They will be temporarily locked out until verified"},{"key":"D","label":"They will receive an automatic extension"}]'::jsonb,
  'C', 'The notice says they will be "temporarily unable to access their accounts until IT support has verified their identity."', 'generated_then_curated', 'enabled',
  '{"topic":"workplace_IT","genre":"company_notice","estimated_seconds":55}'::jsonb
),
(
  'cefr', 'assessment_reading', 'reading', 'b2', 'ar-b2-05', NULL,
  'The concept of "digital detox" — deliberately disconnecting from electronic devices — has gained significant traction in recent years. Proponents argue that constant connectivity disrupts sleep, weakens attention spans, and erodes the quality of face-to-face relationships. Critics, however, contend that the framing pathologises normal behaviour and that the research base is weaker than media coverage suggests.',
  'What do critics of digital detox argue?',
  '[{"key":"A","label":"People should use devices less frequently"},{"key":"B","label":"The research supporting detox is not as strong as claimed"},{"key":"C","label":"Digital detox is too expensive to be practical"},{"key":"D","label":"Connectivity always improves social relationships"}]'::jsonb,
  'B', 'Critics say "the research base is weaker than media coverage suggests."', 'generated_then_curated', 'enabled',
  '{"topic":"digital_wellbeing","genre":"article","estimated_seconds":60}'::jsonb
),
(
  'cefr', 'assessment_reading', 'reading', 'b2', 'ar-b2-06', NULL,
  'After three rounds of funding, the start-up had yet to turn a profit. Investors were growing impatient, and the CEO — aware that another missed quarter would likely trigger a board vote — decided to pivot the company''s strategy dramatically, targeting enterprise clients rather than the consumer market that had, so far, failed to materialise.',
  'Why did the CEO change the company''s strategy?',
  '[{"key":"A","label":"The enterprise market was more fashionable"},{"key":"B","label":"Investors demanded a consumer focus"},{"key":"C","label":"She feared losing control of the company if results did not improve"},{"key":"D","label":"The original product was technically flawed"}]'::jsonb,
  'C', 'The CEO knew "another missed quarter would likely trigger a board vote" — she acted to keep control.', 'generated_then_curated', 'enabled',
  '{"topic":"business_startups","genre":"narrative","estimated_seconds":60}'::jsonb
),
(
  'cefr', 'assessment_reading', 'reading', 'b2', 'ar-b2-07', NULL,
  'Biomimicry — the practice of taking inspiration from nature to solve engineering problems — has produced remarkable innovations. Velcro was modelled on burr seeds; bullet trains were redesigned after the kingfisher''s beak to reduce noise; shark skin has inspired low-drag swimwear. Yet despite its apparent promise, biomimicry remains a niche field, largely because translating biological principles into manufacturable products is far more complex than it first appears.',
  'What does the text suggest is the main limitation of biomimicry?',
  '[{"key":"A","label":"Nature does not offer enough examples"},{"key":"B","label":"It is too expensive to research"},{"key":"C","label":"Turning biological ideas into products is technically difficult"},{"key":"D","label":"Companies are not interested in the approach"}]'::jsonb,
  'C', 'The text says it remains niche "because translating biological principles into manufacturable products is far more complex than it first appears."', 'generated_then_curated', 'enabled',
  '{"topic":"science_technology","genre":"academic_article","estimated_seconds":60}'::jsonb
),
(
  'cefr', 'assessment_reading', 'reading', 'b2', 'ar-b2-08', NULL,
  'The novelist remarked in her interview that she never writes with a reader in mind. "The moment I imagine an audience," she explained, "I start censoring myself. The draft becomes self-conscious, performative — it loses the rawness that, I believe, is the only honest thing writing can offer." Her publisher, diplomatically, declined to comment.',
  'What can be inferred about the novelist''s publisher?',
  '[{"key":"A","label":"The publisher agrees with her approach"},{"key":"B","label":"The publisher is also a novelist"},{"key":"C","label":"The publisher may have reservations about her view"},{"key":"D","label":"The publisher wrote the article about her"}]'::jsonb,
  'C', 'The publisher "diplomatically declined to comment" — the word "diplomatically" implies they have reservations but chose not to say so.', 'generated_then_curated', 'enabled',
  '{"topic":"literature_creativity","genre":"interview_extract","estimated_seconds":65}'::jsonb
);

COMMIT;
