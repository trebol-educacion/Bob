import type { StoredMessage } from '@/actions/messages';
import type { KETShortMessageFeedback, KETShortMessagePrompt } from '@/actions/modes/ket-writing-part6';
import type { PictureStoryFeedback, StoryScene, StorySceneWithImage } from '@/actions/modes/ket-writing-part7';

export interface RestoredShortMessage {
  prompt: KETShortMessagePrompt | null;
  userText: string | null;
  feedback: KETShortMessageFeedback | null;
}

export interface RestoredPictureStory {
  story_premise: string;
  scenes: StorySceneWithImage[];
  framingText: string;
  userText: string;
  feedback: PictureStoryFeedback | null;
}

/**
 * @param messages - stored session messages
 * @returns plan, submitted text and final feedback of a KET Writing Part 6 session
 */
export function restoreShortMessage(messages: StoredMessage[]): RestoredShortMessage {
  let prompt: KETShortMessagePrompt | null = null;
  let userText: string | null = null;
  let feedback: KETShortMessageFeedback | null = null;

  for (const message of messages) {
    const json = message.content_json as Record<string, unknown> | null;
    if (!json) continue;
    if (message.role === 'bob' && json.kind === 'writing_prompt') {
      prompt = {
        scenario: String(json.scenario ?? ''),
        recipient: String(json.recipient ?? 'your friend'),
        contentPoints: (json.content_points as string[]) ?? [],
        wordTarget: Number(json.word_target ?? 25),
        framingText: String(json.framing_text ?? ''),
      };
    }
    if (message.role === 'user' && json.kind === 'writing_submission') {
      userText = String(json.text ?? '');
    }
    if (message.role === 'bob' && message.msg_type === 'evaluation' && json.is_final === true) {
      feedback = {
        understood: Boolean(json.understood),
        highlights: (json.highlights as string[]) ?? [],
        suggestions: (json.suggestions as string[]) ?? [],
        modelAnswer: (json.modelAnswer as string | null) ?? null,
        rubric: (json.rubric as KETShortMessageFeedback['rubric']) ?? undefined,
      };
    }
  }
  return { prompt, userText, feedback };
}

/**
 * @param messages - stored session messages
 * @returns restored KET Writing Part 7 state, or null when the plan message is missing
 */
export function restorePictureStory(messages: StoredMessage[]): RestoredPictureStory | null {
  let story_premise = '';
  let scenes: StorySceneWithImage[] | null = null;
  let framingText = '';
  let userText = '';
  let feedback: PictureStoryFeedback | null = null;

  for (const message of messages) {
    const json = message.content_json as Record<string, unknown> | null;
    if (message.role === 'user' && message.content_text) userText = message.content_text;
    if (!json) continue;
    if (message.role === 'bob' && json.kind === 'picture_story_prompt') {
      story_premise = String(json.story_premise ?? '');
      framingText = String(json.framing_text ?? '');
      const rawScenes = (json.scenes as StoryScene[]) ?? [];
      const imageUrls = (json.image_urls as string[]) ?? [];
      scenes = rawScenes.map((scene, index) => ({ ...scene, image_url: imageUrls[index] ?? '' }));
    }
    if (message.role === 'bob' && message.msg_type === 'evaluation' && json.is_final === true) {
      feedback = {
        understood: Boolean(json.understood),
        highlights: (json.highlights as string[]) ?? [],
        suggestions: (json.suggestions as string[]) ?? [],
        model_answer: (json.model_answer as string) ?? null,
        rubric: (json.rubric as PictureStoryFeedback['rubric']) ?? undefined,
      };
    }
  }
  return scenes ? { story_premise, scenes, framingText, userText, feedback } : null;
}
