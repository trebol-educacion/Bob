BEGIN;

INSERT INTO bob_closed_items (
  framework, exam_part, skill, cefr_level, variant_id,
  stimulus_audio_url, transcript, question, options, correct_key,
  explanation, source, status, metadata
) VALUES

(
  'cambridge', 'fce_listening_part1', 'listening', 'b2', 'fl-p1-01',
  '/fce-listening-part1/fl-p1-01.mp3',
  'I''ve been working in renewable energy consulting for about eight years now, and I can honestly say the sector has changed beyond recognition. When I started, most clients treated sustainable energy as a compliance obligation — something they had to do rather than something they wanted to do. The real shift came when the economics changed. Once solar and wind installations started paying for themselves within five years rather than twenty, the conversation changed entirely. Now my job is less about persuading clients that it''s worth doing and more about helping them prioritise which project to fund first.',
  'What does the speaker say has changed most in her work?',
  '[{"key":"A","label":"Clients now approach sustainability with genuine enthusiasm rather than reluctance"},{"key":"B","label":"Government regulations have become far stricter"},{"key":"C","label":"New technology has made her technical expertise less relevant"}]'::jsonb,
  'A',
  'The speaker explicitly contrasts the original compliance-driven attitude with a new willingness, driven by improved economics.',
  'generated_then_curated',
  'enabled',
  '{"topic":"career_planning","voice":"adult_female","estimated_seconds":45,"question_focus":"attitude"}'::jsonb
),

(
  'cambridge', 'fce_listening_part1', 'listening', 'b2', 'fl-p1-02',
  '/fce-listening-part1/fl-p1-02.mp3',
  'The data collected over the last decade paints a troubling picture for coastal ecosystems. Ocean temperatures have risen by an average of one point two degrees Celsius in the regions we study, which sounds modest until you consider the cascading effects. Coral bleaching events that once occurred roughly every thirty years now happen every five to seven. What concerns me most is not the bleaching itself — corals can recover from individual events — but the shortened recovery windows. The intervals are now so brief that the systems simply cannot rebuild before the next thermal stress event arrives.',
  'What is the speaker most worried about regarding coral reefs?',
  '[{"key":"A","label":"The absolute rise in ocean temperature"},{"key":"B","label":"The lack of time between bleaching events for recovery"},{"key":"C","label":"The declining number of scientists monitoring the reefs"}]'::jsonb,
  'B',
  'The speaker states that shortened recovery windows between bleaching events are the main concern, not the individual events themselves.',
  'generated_then_curated',
  'enabled',
  '{"topic":"environmental_issues","voice":"adult_male","estimated_seconds":48,"question_focus":"opinion"}'::jsonb
),

(
  'cambridge', 'fce_listening_part1', 'listening', 'b2', 'fl-p1-03',
  '/fce-listening-part1/fl-p1-03.mp3',
  'When I look at this painting, I''m immediately drawn to what the artist chose not to include. The left third of the canvas is almost empty — just a wash of cool grey. In any other composition that would read as a mistake, a failure of balance. But here it amplifies the weight of the single figure on the right. She stands completely still, and yet you feel the accumulated tension of whatever preceded this moment. The restraint is what makes it devastating. Some critics have called this work unfinished. I think they''re confusing absence with incompleteness.',
  'What is the speaker''s view of the painting?',
  '[{"key":"A","label":"Its apparent emptiness is a deliberate and effective artistic choice"},{"key":"B","label":"The artist made a technical error that paradoxically works"},{"key":"C","label":"It achieves its impact despite being genuinely unfinished"}]'::jsonb,
  'A',
  'The speaker argues the empty space is intentional and that critics confusing absence with incompleteness are wrong.',
  'generated_then_curated',
  'enabled',
  '{"topic":"art_critique","voice":"adult_female","estimated_seconds":46,"question_focus":"opinion"}'::jsonb
),

(
  'cambridge', 'fce_listening_part1', 'listening', 'b2', 'fl-p1-04',
  '/fce-listening-part1/fl-p1-04.mp3',
  'There''s a question I keep coming back to when I think about algorithmic decision-making in hiring: who is responsible when the system is wrong? Companies typically argue that the algorithm is a neutral tool. But neutrality is impossible when the training data reflects historical hiring patterns that systematically excluded certain groups. The algorithm learns to replicate those patterns precisely because they look like successful outcomes in the data. Calling that neutrality is a category error. The real ethical question is not whether to use AI in hiring, but who bears accountability when it perpetuates injustice.',
  'What is the speaker''s main point about AI in recruitment?',
  '[{"key":"A","label":"Algorithms should be banned from hiring decisions entirely"},{"key":"B","label":"Claiming AI tools are neutral ignores how they inherit historical biases"},{"key":"C","label":"Companies deliberately train systems to discriminate against minorities"}]'::jsonb,
  'B',
  'The speaker argues that neutrality is a category error because the training data itself encodes historical bias — not that companies act with deliberate discriminatory intent.',
  'generated_then_curated',
  'enabled',
  '{"topic":"technology_ethics","voice":"adult_male","estimated_seconds":47,"question_focus":"gist"}'::jsonb
),

(
  'cambridge', 'fce_listening_part1', 'listening', 'b2', 'fl-p1-05',
  '/fce-listening-part1/fl-p1-05.mp3',
  'I''d done enough research on Japan before arriving to feel reasonably prepared. What I hadn''t anticipated was the physical exhaustion of navigating a city that operates on an entirely different logic — signage in unfamiliar scripts, social codes I kept misreading, the particular loneliness of being surrounded by millions of people none of whom need anything from you. By the third day I nearly booked an earlier flight home. What stopped me was a conversation with a local ceramics teacher who spotted me looking lost outside his studio. He invited me in, made tea, and spent two hours showing me traditional raku techniques. That moment reframed everything that followed.',
  'How did the speaker feel during the first few days of the trip?',
  '[{"key":"A","label":"Overwhelmed and tempted to cut the trip short"},{"key":"B","label":"Excited despite finding the language barrier frustrating"},{"key":"C","label":"Disappointed that Japan did not match her expectations"}]'::jsonb,
  'A',
  'The speaker says she nearly booked an earlier flight home on the third day, indicating she was close to abandoning the trip.',
  'generated_then_curated',
  'enabled',
  '{"topic":"travel_experiences","voice":"adult_female","estimated_seconds":50,"question_focus":"feeling"}'::jsonb
),

(
  'cambridge', 'fce_listening_part1', 'listening', 'b2', 'fl-p1-06',
  '/fce-listening-part1/fl-p1-06.mp3',
  'The report released this morning challenges the assumption that reduced working hours automatically lead to lower productivity. Across fourteen companies in six countries, employees who shifted to a four-day week maintained or exceeded their previous output in eleven of those cases. The exceptions were two firms in logistics where real-time coordination requirements made condensed scheduling impractical. The study''s authors are careful to note that the model works differently depending on sector, management culture, and the degree to which tasks can be asynchronous. Blanket conclusions either way would be premature.',
  'What conclusion does the speaker draw about the four-day working week?',
  '[{"key":"A","label":"It consistently improves productivity across all industries"},{"key":"B","label":"Its success depends heavily on the nature of the work and organisation"},{"key":"C","label":"It is only practical in sectors where remote work is possible"}]'::jsonb,
  'B',
  'The speaker quotes the report''s authors warning against blanket conclusions and highlights sector and culture as key variables.',
  'generated_then_curated',
  'enabled',
  '{"topic":"current_affairs","voice":"adult_male","estimated_seconds":48,"question_focus":"detail"}'::jsonb
),

(
  'cambridge', 'fce_listening_part1', 'listening', 'b2', 'fl-p1-07',
  '/fce-listening-part1/fl-p1-07.mp3',
  'The most common misconception I encounter when I talk about quantum computing is that it simply does faster arithmetic. That''s not it. A classical computer works through possibilities sequentially — even a very fast one is still checking options one at a time. A quantum system exploits superposition to hold multiple states simultaneously, which means certain classes of problem — cryptography, molecular modelling, optimisation — can be approached in fundamentally different ways. The bottleneck right now is error rates. The qubits are extraordinarily sensitive to interference from the environment, and managing that decoherence is the central engineering challenge of the decade.',
  'What does the speaker identify as the main obstacle to practical quantum computing?',
  '[{"key":"A","label":"The high cost of building the physical infrastructure"},{"key":"B","label":"The instability of qubits due to environmental interference"},{"key":"C","label":"Public misunderstanding of how the technology works"}]'::jsonb,
  'B',
  'The speaker explicitly names decoherence caused by environmental interference as the central engineering challenge.',
  'generated_then_curated',
  'enabled',
  '{"topic":"scientific_discoveries","voice":"adult_male","estimated_seconds":49,"question_focus":"detail"}'::jsonb
),

(
  'cambridge', 'fce_listening_part1', 'listening', 'b2', 'fl-p1-08',
  '/fce-listening-part1/fl-p1-08.mp3',
  'I grew up in a household where food was culture. My grandmother cooked everything from scratch — not because she was ideologically opposed to convenience, but because that was simply how knowledge passed between generations. You couldn''t just watch her; you had to stand beside her, smell when the onions were right, hear when the oil was ready. That embodied knowledge is almost impossible to document. When she passed away, whole recipes went with her because nobody had thought to write them down. I started the archive because I realised that culinary heritage is disappearing faster than any institution is recording it.',
  'Why did the speaker create the culinary archive?',
  '[{"key":"A","label":"To celebrate her grandmother''s personal cooking legacy"},{"key":"B","label":"To preserve food traditions that are being lost before they are documented"},{"key":"C","label":"To demonstrate that traditional cooking methods are superior to modern ones"}]'::jsonb,
  'B',
  'The speaker generalises beyond her grandmother''s recipes to the broader problem of culinary heritage disappearing faster than institutions can record it.',
  'generated_then_curated',
  'enabled',
  '{"topic":"cultural_reflections","voice":"adult_female","estimated_seconds":50,"question_focus":"purpose"}'::jsonb
),

(
  'cambridge', 'fce_listening_part1', 'listening', 'b2', 'fl-p1-09',
  '/fce-listening-part1/fl-p1-09.mp3',
  'Social media has fundamentally altered the way we form political opinions, and not simply because of misinformation. The deeper effect is structural. Algorithms optimise for engagement, and engagement correlates with emotional arousal — particularly outrage and fear. Over time this doesn''t just distort what people believe; it distorts what they think politics is for. When every issue arrives pre-packaged with a moral adversary, deliberation starts to feel naive. People begin to see compromise not as a democratic virtue but as a form of betrayal. That''s the real corrosion: not specific false claims, but the erosion of the cognitive and emotional conditions that make democratic discourse possible.',
  'According to the speaker, what is the most damaging effect of social media on democracy?',
  '[{"key":"A","label":"The rapid spread of factually incorrect political information"},{"key":"B","label":"The way algorithmic design undermines the conditions needed for political dialogue"},{"key":"C","label":"The decline of long-form journalism in favour of short emotional content"}]'::jsonb,
  'B',
  'The speaker explicitly frames misinformation as secondary to the structural distortion of what people think politics is for, driven by engagement-optimised algorithms.',
  'generated_then_curated',
  'enabled',
  '{"topic":"social_commentary","voice":"teenager_female","estimated_seconds":52,"question_focus":"gist"}'::jsonb
),

(
  'cambridge', 'fce_listening_part1', 'listening', 'b2', 'fl-p1-10',
  '/fce-listening-part1/fl-p1-10.mp3',
  'The assumption that productivity and wellbeing are in tension is one I''d push back on quite firmly. In my experience managing creative teams, the periods of highest output almost always follow periods of genuine rest — not the performative busyness people mistake for rest, scrolling through their phones, but actual cognitive disengagement. The neuroscience supports this: the default mode network, which is active during mind-wandering and daydreaming, plays a crucial role in consolidating learning and generating novel connections. The most counterproductive thing you can do with a creative team is keep them permanently stimulated. You starve the very process that produces original thinking.',
  'What is the speaker''s view on rest and creative work?',
  '[{"key":"A","label":"Rest is a reward for high performance rather than a contributor to it"},{"key":"B","label":"Genuine cognitive disengagement is essential to creative output"},{"key":"C","label":"Creative professionals naturally find it harder to switch off than others"}]'::jsonb,
  'B',
  'The speaker argues that true rest — not performative busyness — enables the cognitive processes that produce original thinking.',
  'generated_then_curated',
  'enabled',
  '{"topic":"opinion_pieces","voice":"adult_male","estimated_seconds":50,"question_focus":"opinion"}'::jsonb
)

ON CONFLICT (framework, exam_part, cefr_level, variant_id) DO NOTHING;

UPDATE bob_prompts
SET
  status = 'enabled',
  label = 'Listening Part 1 — Short Extracts',
  description = 'Listen to 8 short recordings and pick the best answer.'
WHERE prompt_key = 'cambridge_fce_listening_part1_b2_generation';

COMMIT;
