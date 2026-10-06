export const PART_SHORT: Record<string, string> = {
  fce_reading_part2: 'r2',
  fce_reading_part3: 'r3',
  fce_reading_part4: 'r4',
  fce_reading_part5: 'r5',
  fce_reading_part6: 'r6',
  fce_reading_part7: 'r7',
  fce_listening_part1: 'l1',
  fce_listening_part2: 'l2',
  fce_listening_part3: 'l3',
  fce_listening_part4: 'l4',
  fce_reading_part1: 'r1',
  fce_writing_part1: 'w1',
  fce_speaking_part1: 's1',
  fce_speaking_part2: 's2',
  fce_speaking_part4: 's4',
};

/**
 * @param examPart
 * @param slot
 * @returns deterministic group variant id
 */
export function variantId(examPart: string, slot: number): string {
  const short = PART_SHORT[examPart];
  if (!short) throw new Error(`Unknown exam_part ${examPart}`);
  return `gen-${short}-${String(slot).padStart(3, '0')}`;
}

/**
 * @param groupVariant
 * @param position
 * @returns deterministic item variant id
 */
export function itemVariantId(groupVariant: string, position: number): string {
  return `${groupVariant}-q${position}`;
}

/**
 * @param examPart
 * @param variant
 * @param suffix
 * @returns bucket-relative audio path with leading slash
 */
export function audioPath(examPart: string, variant: string, suffix?: string): string {
  const dir = examPart.replace(/_/g, '-');
  return `/${dir}/${variant}${suffix ? `-${suffix}` : ''}.mp3`;
}

/**
 * @param variant
 * @param side
 * @returns bucket-relative image path with leading slash
 */
export function imagePath(variant: string, side: 'a' | 'b'): string {
  return `fce-speaking-part2/${variant}-${side}.jpg`;
}

/**
 * @param variant
 * @returns slot number encoded in a group variant id
 */
export function slotOf(variant: string): number {
  const match = variant.match(/-(\d+)(?:-q\d+)?$/);
  return match ? Number(match[1]) : 0;
}
