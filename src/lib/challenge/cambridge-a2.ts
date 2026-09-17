/**
 * Cambridge A2 Key challenge exam — runtime logic.
 *
 * Builds the exam from the static sample content and merges pre-generated
 * image URLs at read time. Type contracts and content live in sibling modules.
 */

import { challengeImages } from './cambridge-a2-images';
import { SAMPLE_EXAM } from './cambridge-a2.data';
import type { ChallengeExam, ChallengeImageSlotKind, ChallengePart, ImageMap } from './cambridge-a2.types';

export * from './cambridge-a2.types';

/**
 * Stable slot keys for every pre-generated image in the exam. Shared by the
 * pre-generation script and the read-time merge so both agree on the mapping.
 */
export const CHALLENGE_IMAGE_SLOTS: { key: string; description: string; kind: ChallengeImageSlotKind }[] =
  SAMPLE_EXAM.parts.flatMap((part): { key: string; description: string; kind: ChallengeImageSlotKind }[] => {
    if (part.format === 'listening_picture_mc') {
      return part.questions.flatMap((q) =>
        q.options.map((o) => ({ key: `${q.id}:${o.key}`, description: o.caption, kind: 'picture' as const }))
      );
    }
    if (part.format === 'reading_notices_mc') {
      return part.questions.map((q) => ({ key: q.id, description: q.noticeText, kind: 'notice' as const }));
    }
    if (part.format === 'writing_picture_story') {
      return part.pictures.map((p) => ({
        key: `${part.id}:${p.key}`,
        description: p.caption,
        kind: 'story' as const,
      }));
    }
    if (part.format === 'speaking_collaborative') {
      return [{ key: `${part.id}:${part.visual.key}`, description: part.visual.caption, kind: 'collaborative' as const }];
    }
    return [];
  });

function mergeImageUrls(exam: ChallengeExam, images: ImageMap): ChallengeExam {
  return {
    ...exam,
    parts: exam.parts.map((part): ChallengePart => {
      if (part.format === 'listening_picture_mc') {
        return {
          ...part,
          questions: part.questions.map((q) => ({
            ...q,
            options: q.options.map((o) => {
              const url = images[`${q.id}:${o.key}`];
              return url ? { ...o, imageUrl: url } : o;
            }),
          })),
        };
      }
      if (part.format === 'reading_notices_mc') {
        return {
          ...part,
          questions: part.questions.map((q) => {
            const url = images[q.id];
            return url ? { ...q, noticeImageUrl: url } : q;
          }),
        };
      }
      if (part.format === 'writing_picture_story') {
        return {
          ...part,
          pictures: part.pictures.map((p) => {
            const url = images[`${part.id}:${p.key}`];
            return url ? { ...p, imageUrl: url } : p;
          }),
        };
      }
      if (part.format === 'speaking_collaborative') {
        const url = images[`${part.id}:${part.visual.key}`];
        return url ? { ...part, visual: { ...part.visual, imageUrl: url } } : part;
      }
      return part;
    }),
  };
}

/**
 * Returns the active Cambridge A2 Key challenge exam with pre-generated image
 * URLs merged in. Pass `overrideImages` (e.g. from the DB) to use fresh URLs;
 * falls back to the static JSON seed when not provided.
 */
export function getCambridgeA2Exam(overrideImages?: ImageMap): ChallengeExam {
  return mergeImageUrls(SAMPLE_EXAM, overrideImages ?? (challengeImages as ImageMap));
}
