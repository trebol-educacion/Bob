/**
 * db-prompts.ts — Supabase-backed prompt cache for Bob.
 *
 * Fetches prompt text from the `bob_prompts` table and caches it in-process
 * for 5 minutes. On DB failure, falls back to FALLBACK_PROMPTS so Bob keeps
 * working without interruption.
 *
 * Usage:
 *   const text = await getPrompt('situation_phrases', { TOPIC: 'Shopping' })
 */

import { createSupabaseServer } from '@/lib/supabase/server'
import { FALLBACK_PROMPTS } from './fallback-prompts'

export { FALLBACK_PROMPTS } from './fallback-prompts'

type PromptRow = {
  prompt_key: string
  prompt_current: string
  variables: string[] | null
}

let cache: Map<string, PromptRow> = new Map()
let lastFetch: number | null = null
const TTL_MS = 5 * 60 * 1000

async function loadCache(): Promise<void> {
  try {
    const supabase = await createSupabaseServer()
    const { data, error } = await supabase
      .from('prompts')
      .select('prompt_key, prompt_current, variables')

    if (error) {
      console.warn('[db-prompts] Failed to load prompts from DB:', error.message)
      return
    }

    if (!data) {
      console.warn('[db-prompts] DB returned null data, retaining existing cache')
      return
    }

    const newCache = new Map<string, PromptRow>()
    for (const row of data as PromptRow[]) {
      newCache.set(row.prompt_key, row)
    }

    cache = newCache
    lastFetch = Date.now()
  } catch (err) {
    console.warn('[db-prompts] Unexpected error loading prompt cache:', err)
  }
}

/**
 * Substitutes {NAME} placeholders in `template` with values from `params`.
 * - Placeholder format: `{UPPER_CASE_WITH_UNDERSCORES}`
 * - Unmatched placeholders are left as-is and a warning is logged.
 */
function substituteParams(
  key: string,
  template: string,
  params?: Record<string, string | number>
): string {
  const remaining: string[] = []

  const result = template.replace(/\{([A-Z_][A-Z0-9_]*)\}/g, (match, name: string) => {
    if (params && name in params) {
      return String(params[name])
    }
    remaining.push(match)
    return match
  })

  if (remaining.length > 0) {
    console.warn(
      `[getPrompt] unsubstituted placeholder(s) in '${key}':`,
      remaining.join(', ')
    )
  }

  return result
}

/**
 * Retrieves a prompt by key, substituting {NAME} placeholders with `params`.
 *
 * Resolution order:
 *   1. In-process cache (TTL: 5 min) — refreshed from `bob_prompts` table
 *   2. FALLBACK_PROMPTS — used when DB is unreachable or key is missing from DB
 *
 * @throws Error if `key` is not found in either cache or FALLBACK_PROMPTS
 */
export async function getPrompt(
  key: string,
  params?: Record<string, string | number>
): Promise<string> {
  const cacheEmpty = cache.size === 0
  const cacheExpired = lastFetch !== null && Date.now() - lastFetch > TTL_MS

  if (cacheEmpty || cacheExpired) {
    await loadCache()
  }

  let template: string | undefined = cache.get(key)?.prompt_current

  if (template === undefined && !cacheEmpty && !cacheExpired) {
    await loadCache()
    template = cache.get(key)?.prompt_current
  }

  if (template === undefined) {
    template = FALLBACK_PROMPTS[key]
    if (template !== undefined) {
      console.warn(
        `[getPrompt] Key '${key}' not found in DB cache — using fallback prompt`
      )
    }
  }

  if (template === undefined) {
    throw new Error(`[getPrompt] Prompt key not found: '${key}'`)
  }

  return substituteParams(key, template, params)
}
