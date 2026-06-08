/**
 * Benchmark de generación de actividades A2 KET.
 *
 * Mide el tiempo real de cada paso (Gemini texto, TTS, imagen) para cada
 * tipo de actividad y produce una tabla de latencias.
 *
 * Uso:
 *   bun run scripts/benchmark-activities.ts [--activity ket_listening_part2]
 *   bun run scripts/benchmark-activities.ts          # corre todas
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

config({ path: '.env.local' });

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const GEMINI_KEY   = process.env.GEMINI_API_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_KEY) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, GEMINI_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });

const MODEL_TEXT  = 'gemini-2.5-flash';
const MODEL_TTS   = 'gemini-2.5-flash-preview-tts';
const MODEL_IMAGE = 'gemini-2.5-flash-image';

// ─── Timing helpers ───────────────────────────────────────────────────────────

interface StepResult {
  step: string;
  ms: number;
  ok: boolean;
  note?: string;
}

async function time<T>(step: string, fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const t0 = Date.now();
  const result = await fn();
  return { result, ms: Date.now() - t0 };
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

async function fetchPrompt(promptKey: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('bob_prompts')
    .select('prompt_current')
    .eq('prompt_key', promptKey)
    .single();
  if (error || !data) return null;
  return data.prompt_current as string;
}

// ─── Gemini helpers ───────────────────────────────────────────────────────────

async function geminiText(prompt: string): Promise<{ text: string; ms: number; ok: boolean }> {
  const { result, ms } = await time('text', async () => {
    try {
      const res = await ai.models.generateContent({
        model: MODEL_TEXT,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      });
      return res.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    } catch (e) {
      return '';
    }
  });
  return { text: result, ms, ok: result.length > 0 };
}

async function geminiTTS(text: string): Promise<{ bytes: number; ms: number; ok: boolean }> {
  const { result, ms } = await time('tts', async () => {
    try {
      const res = await ai.models.generateContent({
        model: MODEL_TTS,
        contents: [{ role: 'user', parts: [{ text: `Read aloud: "${text}"` }] }],
        config: {
          responseModalities: ['audio'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Sadaltager' } } },
        },
      });
      const part = res.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
      return (part?.inlineData?.data?.length ?? 0) as number;
    } catch {
      return 0;
    }
  });
  return { bytes: result, ms, ok: result > 0 };
}

async function geminiImage(prompt: string): Promise<{ bytes: number; ms: number; ok: boolean }> {
  const { result, ms } = await time('image', async () => {
    try {
      const res = await ai.models.generateContent({
        model: MODEL_IMAGE,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseModalities: ['image', 'text'] },
      });
      const part = res.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));
      return (part?.inlineData?.data?.length ?? 0) as number;
    } catch {
      return 0;
    }
  });
  return { bytes: result, ms, ok: result > 0 };
}

// ─── Activity runners ─────────────────────────────────────────────────────────

type ActivityResult = {
  activity: string;
  steps: StepResult[];
  totalMs: number;
};

async function runListeningPart2(): Promise<ActivityResult> {
  const steps: StepResult[] = [];
  const t0 = Date.now();

  const { result: prompt, ms: promptMs } = await time('db_prompt', () => fetchPrompt('cambridge_ket_listening_part2_a2_generation'));
  steps.push({ step: 'db_prompt', ms: promptMs, ok: !!prompt });

  if (!prompt) return { activity: 'ket_listening_part2', steps, totalMs: Date.now() - t0 };

  const { text, ms: genMs, ok: genOk } = await geminiText(prompt);
  steps.push({ step: 'gemini_text', ms: genMs, ok: genOk, note: genOk ? `${text.length} chars` : 'failed' });

  let transcript = 'Hello, this is a test audio for the benchmark.';
  try { const parsed = JSON.parse(text); transcript = parsed.transcript ?? transcript; } catch {}

  const { ms: ttsMs, ok: ttsOk, bytes } = await geminiTTS(transcript.slice(0, 300));
  steps.push({ step: 'tts', ms: ttsMs, ok: ttsOk, note: ttsOk ? `${Math.round(bytes / 1024)}KB audio` : 'failed' });

  return { activity: 'ket_listening_part2', steps, totalMs: Date.now() - t0 };
}

async function runListeningPart3(): Promise<ActivityResult> {
  const steps: StepResult[] = [];
  const t0 = Date.now();

  const { result: prompt, ms: promptMs } = await time('db_prompt', () => fetchPrompt('cambridge_ket_listening_part3_a2_generation'));
  steps.push({ step: 'db_prompt', ms: promptMs, ok: !!prompt });

  if (!prompt) return { activity: 'ket_listening_part3', steps, totalMs: Date.now() - t0 };

  const { text, ms: genMs, ok: genOk } = await geminiText(prompt);
  steps.push({ step: 'gemini_text', ms: genMs, ok: genOk, note: genOk ? `${text.length} chars` : 'failed' });

  let convoText = 'Man: Hello. Woman: Hi there. Man: How are you today?';
  try {
    const parsed = JSON.parse(text);
    convoText = (parsed.conversation ?? []).map((t: any) => `${t.speaker === 'M' ? 'Man' : 'Woman'}: ${t.line}`).join('\n');
  } catch {}

  const { ms: ttsMs, ok: ttsOk, bytes } = await geminiTTS(convoText.slice(0, 400));
  steps.push({ step: 'tts', ms: ttsMs, ok: ttsOk, note: ttsOk ? `${Math.round(bytes / 1024)}KB audio` : 'failed' });

  return { activity: 'ket_listening_part3', steps, totalMs: Date.now() - t0 };
}

async function runListeningPart4(): Promise<ActivityResult> {
  const steps: StepResult[] = [];
  const t0 = Date.now();

  const { result: prompt, ms: promptMs } = await time('db_prompt', () => fetchPrompt('cambridge_ket_listening_part4_a2_generation'));
  steps.push({ step: 'db_prompt', ms: promptMs, ok: !!prompt });

  if (!prompt) return { activity: 'ket_listening_part4', steps, totalMs: Date.now() - t0 };

  const { text, ms: genMs, ok: genOk } = await geminiText(prompt);
  steps.push({ step: 'gemini_text', ms: genMs, ok: genOk, note: genOk ? `${text.length} chars` : 'failed' });

  const monologues: string[] = [];
  try {
    const parsed = JSON.parse(text);
    for (const p of (parsed.people ?? [])) monologues.push(p.monologue ?? '');
  } catch {}
  const testMonologues = monologues.length === 5 ? monologues : Array(5).fill('Hi, my name is Alex. I love playing football every weekend with my friends.');

  const ttsT0 = Date.now();
  const ttsResults = await Promise.all(testMonologues.map(m => geminiTTS(m.slice(0, 150))));
  const ttsTotalMs = Date.now() - ttsT0;
  const ttsOk = ttsResults.filter(r => r.ok).length;
  steps.push({ step: 'tts_x5_parallel', ms: ttsTotalMs, ok: ttsOk === 5, note: `${ttsOk}/5 ok, individual: ${ttsResults.map(r => r.ms).join('/')}ms` });

  return { activity: 'ket_listening_part4', steps, totalMs: Date.now() - t0 };
}

async function runListeningPart5(): Promise<ActivityResult> {
  const steps: StepResult[] = [];
  const t0 = Date.now();

  const { result: prompt, ms: promptMs } = await time('db_prompt', () => fetchPrompt('cambridge_ket_listening_part5_a2_generation'));
  steps.push({ step: 'db_prompt', ms: promptMs, ok: !!prompt });

  if (!prompt) return { activity: 'ket_listening_part5', steps, totalMs: Date.now() - t0 };

  const { text, ms: genMs, ok: genOk } = await geminiText(prompt);
  steps.push({ step: 'gemini_text', ms: genMs, ok: genOk, note: genOk ? `${text.length} chars` : 'failed' });

  let audioText = 'Today I want to tell you about my favourite hobby.';
  try {
    const parsed = JSON.parse(text);
    audioText = (parsed.audio ?? []).map((t: any) => t.line).join(' ');
  } catch {}

  const { ms: ttsMs, ok: ttsOk, bytes } = await geminiTTS(audioText.slice(0, 300));
  steps.push({ step: 'tts', ms: ttsMs, ok: ttsOk, note: ttsOk ? `${Math.round(bytes / 1024)}KB audio` : 'failed' });

  return { activity: 'ket_listening_part5', steps, totalMs: Date.now() - t0 };
}

async function runReadingPart(partNum: number, promptKey: string, activityKey: string): Promise<ActivityResult> {
  const steps: StepResult[] = [];
  const t0 = Date.now();

  const { result: prompt, ms: promptMs } = await time('db_prompt', () => fetchPrompt(promptKey));
  steps.push({ step: 'db_prompt', ms: promptMs, ok: !!prompt });

  if (!prompt) return { activity: activityKey, steps, totalMs: Date.now() - t0 };

  const { text, ms: genMs, ok: genOk } = await geminiText(prompt);
  steps.push({ step: 'gemini_text', ms: genMs, ok: genOk, note: genOk ? `${text.length} chars` : 'failed' });

  return { activity: activityKey, steps, totalMs: Date.now() - t0 };
}

async function runWritingPart7(): Promise<ActivityResult> {
  const steps: StepResult[] = [];
  const t0 = Date.now();

  const { result: prompt, ms: promptMs } = await time('db_prompt', () => fetchPrompt('cambridge_ket_writing_part7_a2_generation'));
  steps.push({ step: 'db_prompt', ms: promptMs, ok: !!prompt });

  if (!prompt) return { activity: 'ket_writing_part7', steps, totalMs: Date.now() - t0 };

  const { text, ms: genMs, ok: genOk } = await geminiText(prompt);
  steps.push({ step: 'gemini_text', ms: genMs, ok: genOk, note: genOk ? `${text.length} chars` : 'failed' });

  const imagePrompts: string[] = [];
  try {
    const parsed = JSON.parse(text);
    for (const s of (parsed.scenes ?? [])) imagePrompts.push(s.image_prompt ?? '');
  } catch {}
  const testPrompts = imagePrompts.length === 3 ? imagePrompts : [
    'Two children playing football in a park, sunny day, cartoon style',
    'A girl looking for something under a bed, bedroom setting, cartoon style',
    'A boy showing a ball to his friend, both smiling, cartoon style',
  ];

  const imgT0 = Date.now();
  const imgResults = await Promise.all(testPrompts.map(p => geminiImage(p)));
  const imgTotalMs = Date.now() - imgT0;
  const imgOk = imgResults.filter(r => r.ok).length;
  steps.push({ step: 'images_x3_parallel', ms: imgTotalMs, ok: imgOk === 3, note: `${imgOk}/3 ok, individual: ${imgResults.map(r => r.ms).join('/')}ms` });

  return { activity: 'ket_writing_part7', steps, totalMs: Date.now() - t0 };
}

async function runSpeakingPart(partNum: number, promptKey: string, activityKey: string, withImage: boolean): Promise<ActivityResult> {
  const steps: StepResult[] = [];
  const t0 = Date.now();

  const { result: prompt, ms: promptMs } = await time('db_prompt', () => fetchPrompt(promptKey));
  steps.push({ step: 'db_prompt', ms: promptMs, ok: !!prompt });

  if (!prompt) return { activity: activityKey, steps, totalMs: Date.now() - t0 };

  const { text, ms: genMs, ok: genOk } = await geminiText(prompt);
  steps.push({ step: 'gemini_text', ms: genMs, ok: genOk, note: genOk ? `${text.length} chars` : 'failed' });

  let instruction = 'Now tell me about your favourite hobby.';
  let imagePrompt = 'A teenager playing football in a park, cartoon style';
  try {
    const parsed = JSON.parse(text);
    instruction = parsed.instruction ?? instruction;
    imagePrompt = parsed.image_prompt ?? imagePrompt;
  } catch {}

  const [ttsResult, imgResult] = await Promise.all([
    geminiTTS(instruction),
    withImage ? geminiImage(imagePrompt) : Promise.resolve({ bytes: 0, ms: 0, ok: true }),
  ]);

  steps.push({ step: 'tts', ms: ttsResult.ms, ok: ttsResult.ok });
  if (withImage) steps.push({ step: 'image', ms: imgResult.ms, ok: imgResult.ok });

  return { activity: activityKey, steps, totalMs: Date.now() - t0 };
}

// ─── Report ───────────────────────────────────────────────────────────────────

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function printReport(results: ActivityResult[]) {
  const divider = '─'.repeat(90);
  console.log('\n' + divider);
  console.log('  BENCHMARK — Generación de actividades A2 KET');
  console.log(divider);

  for (const r of results) {
    const statusIcon = r.steps.every(s => s.ok) ? '✅' : '⚠️ ';
    console.log(`\n${statusIcon} ${r.activity.padEnd(35)} TOTAL: ${formatMs(r.totalMs)}`);
    for (const s of r.steps) {
      const icon = s.ok ? '  ✓' : '  ✗';
      const note = s.note ? `  (${s.note})` : '';
      console.log(`${icon}  ${s.step.padEnd(25)} ${formatMs(s.ms)}${note}`);
    }
  }

  console.log('\n' + divider);
  console.log('  RESUMEN POR PASO (promedio)');
  console.log(divider);

  const stepTotals: Record<string, { total: number; count: number }> = {};
  for (const r of results) {
    for (const s of r.steps) {
      const key = s.step.replace(/_x\d+.*/, '_xN');
      if (!stepTotals[key]) stepTotals[key] = { total: 0, count: 0 };
      stepTotals[key].total += s.ms;
      stepTotals[key].count += 1;
    }
  }
  for (const [step, { total, count }] of Object.entries(stepTotals)) {
    const avg = Math.round(total / count);
    console.log(`  ${step.padEnd(30)} avg: ${formatMs(avg)}  (n=${count})`);
  }

  console.log('\n' + divider);
  console.log('  RANKING — más lentas primero');
  console.log(divider);
  const sorted = [...results].sort((a, b) => b.totalMs - a.totalMs);
  for (const r of sorted) {
    console.log(`  ${formatMs(r.totalMs).padEnd(8)} ${r.activity}`);
  }
  console.log(divider + '\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const ACTIVITIES: Record<string, () => Promise<ActivityResult>> = {
  ket_listening_part2: runListeningPart2,
  ket_listening_part3: runListeningPart3,
  ket_listening_part4: runListeningPart4,
  ket_listening_part5: runListeningPart5,
  ket_reading_part2: () => runReadingPart(2, 'cambridge_ket_reading_part2_a2_generation', 'ket_reading_part2'),
  ket_reading_part3: () => runReadingPart(3, 'cambridge_ket_reading_part3_a2_generation', 'ket_reading_part3'),
  ket_reading_part4: () => runReadingPart(4, 'cambridge_ket_reading_part4_a2_generation', 'ket_reading_part4'),
  ket_reading_part5: () => runReadingPart(5, 'cambridge_ket_reading_part5_a2_generation', 'ket_reading_part5'),
  ket_writing_part7: runWritingPart7,
  ket_speaking_part2: () => runSpeakingPart(2, 'cambridge_ket_part2_a2_generation', 'ket_speaking_part2', true),
  ket_speaking_part3: () => runSpeakingPart(3, 'cambridge_ket_part3_a2_generation', 'ket_speaking_part3', true),
};

async function main() {
  const arg = process.argv.find(a => a.startsWith('--activity='))?.split('=')[1];
  const toRun = arg ? { [arg]: ACTIVITIES[arg] } : ACTIVITIES;

  if (arg && !ACTIVITIES[arg]) {
    console.error(`Unknown activity: ${arg}`);
    console.error('Available:', Object.keys(ACTIVITIES).join(', '));
    process.exit(1);
  }

  const total = Object.keys(toRun).length;
  console.log(`\nRunning ${total} benchmark${total > 1 ? 's' : ''}...`);
  if (total > 1) console.log('(runs sequentially to avoid rate limiting)\n');

  const results: ActivityResult[] = [];
  for (const [key, fn] of Object.entries(toRun)) {
    process.stdout.write(`  → ${key}... `);
    const result = await fn();
    results.push(result);
    console.log(`done (${formatMs(result.totalMs)})`);
  }

  printReport(results);
}

main().catch(err => { console.error(err); process.exit(1); });
