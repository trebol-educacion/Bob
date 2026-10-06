const PART_NUMBER = /part(\d+)$/;

/**
 * @param examPart exam part key
 * @returns "Part N" or null when the key has no part number
 */
export function partLabel(examPart: string): string | null {
  const match = PART_NUMBER.exec(examPart);
  return match ? `Part ${match[1]}` : null;
}
