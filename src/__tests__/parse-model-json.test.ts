import { describe, expect, it } from 'vitest';
import { parseModelJson, stripCodeFence } from '@/lib/llm/parse-model-json';

describe('parseModelJson', () => {
  it('parses clean objects and arrays', () => {
    expect(parseModelJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseModelJson('[1,2,3]')).toEqual([1, 2, 3]);
    expect(parseModelJson('  {"a":1}\n')).toEqual({ a: 1 });
  });

  it('ignores the real trailing garbage seen in Gemini', () => {
    const text = '{"feedback":[{"register":"semi-formal"}]}\nformal"}]}\n}]}';
    expect(parseModelJson(text)).toEqual({ feedback: [{ register: 'semi-formal' }] });
  });

  it('ignores trailing garbage after arrays', () => {
    expect(parseModelJson('[{"a":1}]\n}]}')).toEqual([{ a: 1 }]);
  });

  it('ignores leading prose', () => {
    expect(parseModelJson('Here you go: {"a":1}')).toEqual({ a: 1 });
  });

  it('keeps braces and brackets inside strings', () => {
    const text = '{"a":"x } ] { [ y","b":[1]}}}';
    expect(parseModelJson(text)).toEqual({ a: 'x } ] { [ y', b: [1] });
  });

  it('handles escaped quotes and backslashes in strings', () => {
    const text = '{"a":"say \\"hi}\\"","b":"path\\\\"}garbage"}';
    expect(parseModelJson(text)).toEqual({ a: 'say "hi}"', b: 'path\\' });
  });

  it('strips markdown fences', () => {
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseModelJson('```\n[1]\n```')).toEqual([1]);
  });

  it('handles fenced JSON with trailing garbage', () => {
    expect(parseModelJson('```json\n{"a":1}\n}]}\n```')).toEqual({ a: 1 });
  });

  it('throws when there is no JSON', () => {
    expect(() => parseModelJson('no json here')).toThrow(SyntaxError);
    expect(() => parseModelJson('')).toThrow(SyntaxError);
  });

  it('throws on truncated JSON', () => {
    expect(() => parseModelJson('{"a":[1,2')).toThrow(SyntaxError);
    expect(() => parseModelJson('{"a":"unterminated')).toThrow(SyntaxError);
  });

  it('throws when the balanced chunk is invalid', () => {
    expect(() => parseModelJson('{a:1} trailing')).toThrow(SyntaxError);
  });

  it('throws on mismatched closers', () => {
    expect(() => parseModelJson('{"a":1]')).toThrow(SyntaxError);
  });
});

describe('stripCodeFence', () => {
  it('returns trimmed text when there is no fence', () => {
    expect(stripCodeFence('  {"a":1} ')).toBe('{"a":1}');
  });
});
