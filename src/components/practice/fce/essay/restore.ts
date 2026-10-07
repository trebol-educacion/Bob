import type { StoredMessage } from '@/actions/messages';
import type { FCEEssayPrompt, FCEEssayFeedback } from '@/actions/modes/fce-writing-part1';
import type { EssayNote } from '@/lib/writing/fce-essay-bank';
import { parseFceRubric } from '@/lib/writing/fce-rubric';

export function tryRestoreFromMessages(messages: StoredMessage[]): {
  prompt: FCEEssayPrompt | null;
  userText: string | null;
  feedback: FCEEssayFeedback | null;
} {
  let prompt: FCEEssayPrompt | null = null;
  let userText: string | null = null;
  let feedback: FCEEssayFeedback | null = null;

  for (const msg of messages) {
    const cj = msg.content_json as Record<string, unknown> | null;
    if (!cj) continue;

    if (msg.role === 'bob' && cj.kind === 'essay_prompt') {
      const rawNotes = cj.notes as EssayNote[] | null;
      if (rawNotes && rawNotes.length === 3) {
        prompt = {
          title: String(cj.title ?? ''),
          essayQuestion: String(cj.essay_question ?? ''),
          context: String(cj.context ?? ''),
          notes: rawNotes as [EssayNote, EssayNote, EssayNote],
          wordTargetMin: 140,
          wordTargetMax: 190,
          framingText: String(cj.framing_text ?? ''),
          bankGroupId: String(cj.bank_group_id ?? ''),
        };
      }
    }
    if (msg.role === 'user' && cj.kind === 'writing_submission') {
      userText = String(cj.text ?? '');
    }
    if (msg.role === 'bob' && msg.msg_type === 'evaluation' && cj.is_final === true) {
      feedback = {
        understood: Boolean(cj.understood),
        highlights: (cj.highlights as string[]) ?? [],
        suggestions: (cj.suggestions as string[]) ?? [],
        notesCovered: (cj.notesCovered as [boolean, boolean, boolean]) ?? [false, false, false],
        organization: (cj.organization as FCEEssayFeedback['organization']) ?? 'OK',
        register: (cj.register as FCEEssayFeedback['register']) ?? 'OK',
        modelAnswer: (cj.modelAnswer as string | null) ?? null,
        score10: typeof cj.score_10 === 'number' ? cj.score_10 : null,
        fceRubric: parseFceRubric(cj.fce_rubric),
      };
    }
  }

  return { prompt, userText, feedback };
}
