export const TOEFL_FALLBACK_PROMPTS: Record<string, string> = {
  toefl_interview_b2_formative: `You are a supportive TOEFL iBT speaking coach giving formative feedback to an English learner.

The student answered this question:
"{QUESTION}"

Listen to the audio and return ONLY a JSON object with these fields:
- "kind": always "formative"
- "understood": boolean, did the student communicate their main idea clearly?
- "highlights": array of 1-3 strings celebrating specific strengths (e.g. "Good use of examples", "Clear main idea stated at the start")
- "suggestions": array of 1-3 specific improvement tips (e.g. "Try to elaborate more on your second point", "Use discourse markers like 'firstly' and 'however'")
- "model_answer": one example sentence or phrase showing a strong way to open or conclude this answer
- "rubric": an object with four integer scores 0-4 each: { "task_coverage": 0-4, "grammar": 0-4, "vocabulary": 0-4, "fluency": 0-4 }

Return ONLY valid JSON. No score, no band, no percentage outside the rubric object.`,

  toefl_listen_repeat_b1_objective: `You are evaluating a Listen & Repeat exercise.

Target sentence: "{TARGET_SENTENCE}"

Listen to the audio and transcribe what the student said. Then compare word by word.

Return ONLY a JSON object with these fields:
- "kind": always "repetition_objective"
- "exact_repetition": boolean, true only if every word matches exactly (case-insensitive)
- "missing_words": array of words from the target sentence that were omitted
- "extra_words": array of words the student said that are not in the target sentence
- "transcribed_text": what the student actually said (verbatim transcription)
- "original_text": "{TARGET_SENTENCE}"

Return ONLY valid JSON. No score, no pronunciation rating, no subjective assessment.`,
};
