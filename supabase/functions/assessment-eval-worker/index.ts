import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { parseModelJson } from "../../../src/lib/llm/parse-model-json.ts";

const VALID_CEFR_BANDS = ["pre_a1", "a1", "a2", "b1", "b2"] as const;
const VALID_CONFIDENCE = ["low", "medium", "high"] as const;
const DEFAULT_TEXT_MODEL = "gemini-3-flash-preview";
const TEXT_MODEL = Deno.env.get("GEMINI_TEXT_MODEL")?.trim() || DEFAULT_TEXT_MODEL;

type CefrBand = typeof VALID_CEFR_BANDS[number];
type Confidence = typeof VALID_CONFIDENCE[number];

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
    .from("prompts")
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

async function processWriting(
  supabase: ReturnType<typeof createClient>,
  geminiKey: string,
  queueId: string,
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

  const rawText = await callGeminiRaw(geminiKey, TEXT_MODEL, contents, responseSchema);
  if (!rawText) throw new Error("Empty response from Gemini");

  const parsed = parseModelJson(rawText) as WritingEvalResult;

  if (!VALID_CEFR_BANDS.includes(parsed.cefr_band) || !VALID_CONFIDENCE.includes(parsed.confidence)) {
    throw new Error(`Invalid band/confidence: ${parsed.cefr_band} / ${parsed.confidence}`);
  }

  const { error } = await supabase.rpc("apply_assessment_result", {
    p_queue_id: queueId,
    p_cefr_band: parsed.cefr_band,
    p_confidence: parsed.confidence,
    p_feedback: parsed.feedback,
    p_extra: { bullets_covered: parsed.bullets_covered },
  });
  if (error) throw new Error(error.message);
}

Deno.serve(async (req: Request) => {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
    db: { schema: "bob" },
  });

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: authConfig } = await supabase
    .from("app_config")
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
    .from("assessment_queue")
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

  if (row.skill === "speaking") {
    await supabase.rpc("fail_assessment", { p_queue_id: queueId, p_error: "speaking_evaluated_in_app" });
    return new Response(JSON.stringify({ ok: true, queue_id: queueId, skipped: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  await supabase
    .from("assessment_queue")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("id", queueId);

  const geminiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
  if (!geminiKey) {
    await supabase
      .from("assessment_queue")
      .update({ status: "failed", error: "GEMINI_API_KEY not configured", completed_at: new Date().toISOString() })
      .eq("id", queueId);

    return new Response(JSON.stringify({ ok: false, error: "GEMINI_API_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    if (row.skill !== "writing") {
      throw new Error(`Unsupported skill for LLM evaluation: ${row.skill}`);
    }
    await processWriting(supabase, geminiKey, row.id, row.payload);

    return new Response(JSON.stringify({ ok: true, queue_id: queueId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ event: "eval_worker_error", queue_id: queueId, error: message }));

    await supabase.rpc("fail_assessment", { p_queue_id: queueId, p_error: message });

    return new Response(JSON.stringify({ ok: false, error: message, queue_id: queueId }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
