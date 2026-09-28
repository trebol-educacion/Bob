const CODE_FENCE_RE = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;
const ANSWER_FIELD_RE = /"answer"\s*:\s*"((?:\\.|[^"\\])*)"/;

/** @param raw string */
function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(CODE_FENCE_RE);
  return match ? match[1].trim() : trimmed;
}

/** @param text string */
function extractAnswerFromParsedJson(text: string): string | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'answer' in parsed &&
      typeof (parsed as Record<string, unknown>).answer === 'string'
    ) {
      return ((parsed as Record<string, string>).answer).trim();
    }
  } catch {
    return null;
  }
  return null;
}

/** @param text string */
function extractAnswerFieldByRegex(text: string): string | null {
  const match = text.match(ANSWER_FIELD_RE);
  if (!match) return null;
  try {
    return (JSON.parse(`"${match[1]}"`) as string).trim();
  } catch {
    return match[1].trim();
  }
}

/** @param text string */
function sanitizePlainText(text: string): string {
  if (!/^[{[]/.test(text)) return text.trim();
  return text
    .replace(/^[{[]+|[}\]]+$/g, '')
    .replace(/"([^"]*)"\s*:/g, '')
    .replace(/["{}[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param raw string
 * @returns string
 */
export function parseSuggestedAnswer(raw: string): string {
  const unfenced = stripCodeFence(raw ?? '');
  return (
    extractAnswerFromParsedJson(unfenced) ??
    extractAnswerFieldByRegex(unfenced) ??
    sanitizePlainText(unfenced)
  );
}
