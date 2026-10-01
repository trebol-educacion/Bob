import type { GapTextSegment } from './types';

const GAP_MARKER = /(___\d+___)/g;
const GAP_NUMBER = /^___(\d+)___$/;

/**
 * @param text
 * @returns segments
 */
export function splitGapText(text: string): GapTextSegment[] {
  return text.split(GAP_MARKER).map((part) => {
    const match = part.match(GAP_NUMBER);
    return match ? { kind: 'gap', number: parseInt(match[1], 10) } : { kind: 'text', value: part };
  });
}
