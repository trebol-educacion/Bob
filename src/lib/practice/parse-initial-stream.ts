const ESCAPE_MAP: Record<string, string> = {
  n: '\n',
  t: '\t',
  r: '\r',
  '"': '"',
  '\\': '\\',
  '/': '/',
  b: '\b',
  f: '\f',
};

export interface PartialStringField {
  value: string;
  complete: boolean;
}

/**
 * @param buffer string
 * @param key string
 * @returns PartialStringField | null
 */
export function extractPartialStringField(buffer: string, key: string): PartialStringField | null {
  const marker = `"${key}"`;
  const markerIndex = buffer.indexOf(marker);
  if (markerIndex === -1) return null;

  let i = markerIndex + marker.length;
  while (i < buffer.length && /[\s:]/.test(buffer[i])) i++;
  if (i >= buffer.length) return null;
  if (buffer[i] !== '"') return null;
  i++;

  let value = '';
  while (i < buffer.length) {
    const ch = buffer[i];
    if (ch === '\\') {
      const next = buffer[i + 1];
      if (next === undefined) return { value, complete: false };
      value += ESCAPE_MAP[next] ?? next;
      i += 2;
      continue;
    }
    if (ch === '"') return { value, complete: true };
    value += ch;
    i++;
  }
  return { value, complete: false };
}

export interface InitialTurnStreamState {
  framing: string;
  message: string;
  messageComplete: boolean;
}

/**
 * @param buffer string
 * @returns InitialTurnStreamState
 */
export function parseInitialTurnStream(buffer: string): InitialTurnStreamState {
  const framing = extractPartialStringField(buffer, 'framing');
  const message = extractPartialStringField(buffer, 'message') ?? extractPartialStringField(buffer, 'first_message');
  return {
    framing: framing?.value ?? '',
    message: message?.value ?? '',
    messageComplete: message?.complete ?? false,
  };
}
