const CODE_FENCE_RE = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;
const OPENERS: Readonly<Record<string, string>> = { '{': '}', '[': ']' };

/**
 * @param raw model text
 * @returns text without the surrounding markdown fence
 */
export function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(CODE_FENCE_RE);
  return match ? match[1].trim() : trimmed;
}

function firstBalancedValue(text: string): string | null {
  const start = text.search(/[{[]/);
  if (start === -1) return null;
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char in OPENERS) stack.push(OPENERS[char]);
    else if (char === '}' || char === ']') {
      if (stack.pop() !== char) return null;
      if (stack.length === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * @param text raw model output expected to hold JSON
 * @returns parsed first JSON value, ignoring fences and trailing garbage
 * @throws original JSON.parse error when no valid value can be recovered
 */
export function parseModelJson(text: string): unknown {
  const cleaned = stripCodeFence(text);
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const candidate = firstBalancedValue(cleaned);
    if (candidate === null) throw error;
    try {
      return JSON.parse(candidate);
    } catch {
      throw error;
    }
  }
}
