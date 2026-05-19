import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const VALID_CEFR_BANDS = ["pre_a1", "a1", "a2", "b1", "b2"] as const;
const VALID_CONFIDENCE = ["low", "medium", "high"] as const;

type CefrBand = typeof VALID_CEFR_BANDS[number];
type Confidence = typeof VALID_CONFIDENCE[number];

interface SpeakingEvalResult {
  cefr_band: CefrBand;
  confidence: Confidence;
  feedback: {
    kind: string;
    highlights: string[];
    suggestions: string[];
    overall_message: string;
  };
}

interface WritingEvalResult {
  cefr_band: CefrBand;
  confidence: Confidence;
  bullets_covered: number;
  feedback: {
    strengths: string[];
    improvements: string[];
    next_step: string;
  };
}

function confidenceToNumeric(c: Confidence): number {
  if (c === "low") return 0.3;
  if (c === "medium") return 0.65;
  return 0.9;
}

function buildSpeakingEvalKey(currentLevel: string, isYl: boolean): string {
  if (isYl) {
    return currentLevel === "pre_a1"
      ? "cefr_assessment_speaking_yl_pre_a1_evaluation"
      : "cefr_assessment_speaking_yl_a1_evaluation";
  }
  const higherRange = currentLevel === "b1" || currentLevel === "b2";
  return higherRange
    ? "cefr_assessment_speaking_b1_b2_evaluation"
    : "cefr_assessment_speaking_a1_a2_evaluation";
}

function buildWritingEvalKey(currentLevel: string): string {
  const higherRange = currentLevel === "b1" || currentLevel === "b2";
  return higherRange
    ? "cefr_assessment_writing_b1_b2_evaluation"
    : "cefr_assessment_writing_a1_a2_evaluation";
}

async function fetchPrompt(
  supabase: ReturnType<typeof createClient>,
  promptKey: string,
  vars: Record<string, string> = {}
): Promise<string | null> {
  const { data, error } = await supabase
    .from("bob_prompts")
    .select("prompt_current")
    .eq("prompt_key", promptKey)
    .maybeSingle();

  if (error || !data) return null;

  let text: string = data.prompt_current as string;
  for (const [k, v] of Object.entries(vars)) {
    text = text.replaceAll(`{${k}}`, v);
  }
  return text;
}

async function callGeminiRaw(
  apiKey: string,
  model: string,
  contents: unknown[],
  responseSchema: unknown
): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(JSON.stringify({ event: "gemini_error", status: res.status, body: errText }));
    return null;
  }

  const json = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

async function processSpeaking(
  supabase: ReturnType<typeof createClient>,
  geminiKey: string,
  queueId: string,
  userId: string,
  assessmentId: string,
  sessionId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const currentLevel = (payload.current_level as string) ?? "a2";
  const isYl = (payload.is_yl as boolean) ?? false;

  const { data: audioMessages } = await supabase
    .from("bob_messages")
    .select("content_json, content_text")
    .eq("session_id", sessionId)
    .eq("role", "user")
    .filter("content_json->>assessment_id", "eq", assessmentId)
    .order("created_at", { ascending: true });

  const rows = (audioMessages ?? []) as Array<{
    content_json: Record<string, unknown>;
    content_text: string | null;
  }>;

  const transcripts = rows
    .map((r, i) => `Turn ${i + 1}: ${r.content_text ?? (r.content_json.transcript as string | undefined) ?? "[no transcript]"}`)
    .join("\n");

  const evalKey = buildSpeakingEvalKey(currentLevel, isYl);
  const promptText = await fetchPrompt(supabase, evalKey, { TRANSCRIPTS: transcripts });
  if (!promptText) {
    throw new Error(`Prompt not found: ${evalKey}`);
  }

  const audioParts = rows
    .map((r) => {
      const cj = r.content_json;
      if (cj.audio_base64 && cj.mime_type) {
        return { inlineData: { data: cj.audio_base64 as string, mimeType: cj.mime_type as string } };
      }
      return null;
    })
    .filter(Boolean);

  const responseSchema = {
    type: "object",
    properties: {
      cefr_band: { type: "string" },
      confidence: { type: "string" },
      feedback: {
        type: "object",
        properties: {
          kind: { type: "string" },
          highlights: { type: "array", items: { type: "string" } },
          suggestions: { type: "array", items: { type: "string" } },
          overall_message: { type: "string" },
        },
        required: ["kind", "highlights", "suggestions", "overall_message"],
      },
    },
    required: ["cefr_band", "confidence", "feedback"],
  };

  const contents = [
    {
      role: "user",
      parts: [
        ...audioParts,
        { text: promptText },
      ],
    },
  ];

  const rawText = await callGeminiRaw(geminiKey, "gemini-2.5-flash", contents, responseSchema);
  if (!rawText) throw new Error("Empty response from Gemini");

  const parsed = JSON.parse(rawText) as SpeakingEvalResult;

  if (!VALID_CEFR_BANDS.includes(parsed.cefr_band) || !VALID_CONFIDENCE.includes(parsed.confidence)) {
    throw new Error(`Invalid band/confidence: ${parsed.cefr_band} / ${parsed.confidence}`);
  }

  const confidenceNumeric = confidenceToNumeric(parsed.confidence);

  try {
    await supabase.rpc("set_config", {
      setting: "bob.assessment_id",
      value: assessmentId,
      is_local: true,
    });
  } catch { /* non-critical, trigger uses NULL */ }

  await supabase.from("bob_skill_levels").upsert({
    user_id: userId,
    skill: "speaking",
    cefr_level: parsed.cefr_band,
    origin: "assessment",
    confidence: confidenceNumeric,
    last_assessment_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,skill" });

  const cooldownUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await supabase
    .from("bob_messages")
    .update({
      content_json: {
        assessment_id: assessmentId,
        status: "done",
        cefr_band: parsed.cefr_band,
        confidence: parsed.confidence,
        feedback: parsed.feedback,
        cooldown_until: cooldownUntil,
      },
    })
    .eq("session_id", sessionId)
    .filter("content_json->>assessment_id", "eq", assessmentId)
    .filter("content_json->>status", "eq", "pending");

  await supabase
    .from("bob_assessment_queue")
    .update({
      status: "done",
      result: { cefr_band: parsed.cefr_band, confidence: parsed.confidence, feedback: parsed.feedback },
      completed_at: new Date().toISOString(),
    })
    .eq("id", queueId);
}

async function processWriting(
  supabase: ReturnType<typeof createClient>,
  geminiKey: string,
  queueId: string,
  userId: string,
  assessmentId: string,
  sessionId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const currentLevel = (payload.current_level as string) ?? "a1";
  const writtenText = (payload.written_text as string) ?? "";

  if (!writtenText) throw new Error("written_text missing from payload");

  const evalKey = buildWritingEvalKey(currentLevel);
  const promptText = await fetchPrompt(supabase, evalKey, { WRITTEN_TEXT: writtenText });
  if (!promptText) throw new Error(`Prompt not found: ${evalKey}`);

  const responseSchema = {
    type: "object",
    properties: {
      cefr_band: { type: "string" },
      confidence: { type: "string" },
      bullets_covered: { type: "integer" },
      feedback: {
        type: "object",
        properties: {
          strengths: { type: "array", items: { type: "string" } },
          improvements: { type: "array", items: { type: "string" } },
          next_step: { type: "string" },
        },
        required: ["strengths", "improvements", "next_step"],
      },
    },
    required: ["cefr_band", "confidence", "bullets_covered", "feedback"],
  };

  const contents = [
    { role: "user", parts: [{ text: promptText }] },
  ];

  const rawText = await callGeminiRaw(geminiKey, "gemini-2.5-flash", contents, responseSchema);
  if (!rawText) throw new Error("Empty response from Gemini");

  const parsed = JSON.parse(rawText) as WritingEvalResult;

  if (!VALID_CEFR_BANDS.includes(parsed.cefr_band) || !VALID_CONFIDENCE.includes(parsed.confidence)) {
    throw new Error(`Invalid band/confidence: ${parsed.cefr_band} / ${parsed.confidence}`);
  }

  const confidenceNumeric = confidenceToNumeric(parsed.confidence);

  try {
    await supabase.rpc("set_config", {
      setting: "bob.assessment_id",
      value: assessmentId,
      is_local: true,
    });
  } catch { /* non-critical, trigger uses NULL */ }

  await supabase.from("bob_skill_levels").upsert({
    user_id: userId,
    skill: "writing",
    cefr_level: parsed.cefr_band,
    origin: "assessment",
    confidence: confidenceNumeric,
    last_assessment_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,skill" });

  const cooldownUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await supabase
    .from("bob_messages")
    .update({
      content_json: {
        assessment_id: assessmentId,
        status: "done",
        cefr_band: parsed.cefr_band,
        confidence: parsed.confidence,
        bullets_covered: parsed.bullets_covered,
        feedback: parsed.feedback,
        cooldown_until: cooldownUntil,
      },
    })
    .eq("session_id", sessionId)
    .filter("content_json->>assessment_id", "eq", assessmentId)
    .filter("content_json->>status", "eq", "pending");

  await supabase
    .from("bob_assessment_queue")
    .update({
      status: "done",
      result: {
        cefr_band: parsed.cefr_band,
        confidence: parsed.confidence,
        bullets_covered: parsed.bullets_covered,
        feedback: parsed.feedback,
      },
      completed_at: new Date().toISOString(),
    })
    .eq("id", queueId);
}

Deno.serve(async (req: Request) => {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: authConfig } = await supabase
    .from("bob_app_config")
    .select("value")
    .eq("key", "worker_auth")
    .maybeSingle();
  const expectedToken = authConfig?.value ?? "";
  if (!token || !expectedToken || token !== expectedToken) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const queueId = body.queue_id as string | undefined;
  if (!queueId) {
    return new Response(JSON.stringify({ ok: false, error: "queue_id required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: queueRow, error: queueErr } = await supabase
    .from("bob_assessment_queue")
    .select("*")
    .eq("id", queueId)
    .maybeSingle();

  if (queueErr || !queueRow) {
    return new Response(JSON.stringify({ ok: false, error: "queue row not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const row = queueRow as {
    id: string;
    user_id: string;
    assessment_id: string;
    skill: string;
    session_id: string;
    payload: Record<string, unknown>;
    status: string;
  };

  if (row.status !== "pending") {
    return new Response(JSON.stringify({ ok: true, queue_id: queueId, skipped: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  await supabase
    .from("bob_assessment_queue")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("id", queueId);

  const geminiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
  if (!geminiKey) {
    await supabase
      .from("bob_assessment_queue")
      .update({ status: "failed", error: "GEMINI_API_KEY not configured", completed_at: new Date().toISOString() })
      .eq("id", queueId);

    return new Response(JSON.stringify({ ok: false, error: "GEMINI_API_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    if (row.skill === "speaking") {
      await processSpeaking(
        supabase, geminiKey, row.id, row.user_id,
        row.assessment_id, row.session_id, row.payload
      );
    } else if (row.skill === "writing") {
      await processWriting(
        supabase, geminiKey, row.id, row.user_id,
        row.assessment_id, row.session_id, row.payload
      );
    } else {
      throw new Error(`Unsupported skill for LLM evaluation: ${row.skill}`);
    }

    return new Response(JSON.stringify({ ok: true, queue_id: queueId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ event: "eval_worker_error", queue_id: queueId, error: message }));

    await supabase
      .from("bob_assessment_queue")
      .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
      .eq("id", queueId);

    await supabase
      .from("bob_messages")
      .update({
        content_json: {
          assessment_id: row.assessment_id,
          status: "failed",
          error: message,
        },
      })
      .eq("session_id", row.session_id)
      .filter("content_json->>assessment_id", "eq", row.assessment_id)
      .filter("content_json->>status", "eq", "pending");

    return new Response(JSON.stringify({ ok: false, error: message, queue_id: queueId }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
