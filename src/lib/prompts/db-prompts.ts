import { createSupabaseServer } from '@/lib/supabase/server'
import { FALLBACK_PROMPTS as BASE_FALLBACK_PROMPTS } from './fallback-prompts'
import { PRACTICE_FALLBACK_PROMPTS } from './fallback-prompts-practice'
import { createPromptCache } from './prompt-cache'

export const FALLBACK_PROMPTS: Record<string, string> = {
  ...BASE_FALLBACK_PROMPTS,
  ...PRACTICE_FALLBACK_PROMPTS,
}

const promptCache = createPromptCache({
  load: async (key) => {
    const supabase = await createSupabaseServer()
    const { data, error } = await supabase
      .from('prompts')
      .select('prompt_current')
      .eq('prompt_key', key)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return (data?.prompt_current as string | undefined) ?? null
  },
})

/**
 * @param key string
 * @param template string
 * @param params Record<string, string | number>
 * @returns string
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
 * @param key string
 * @param params Record<string, string | number>
 * @returns Promise<string>
 * @throws Error when the key is in neither the database nor FALLBACK_PROMPTS
 */
export async function getPrompt(
  key: string,
  params?: Record<string, string | number>
): Promise<string> {
  const fromDb = await promptCache.get(key)
  const template = fromDb ?? FALLBACK_PROMPTS[key]

  if (template === undefined) {
    throw new Error(`[getPrompt] Prompt key not found: '${key}'`)
  }

  return substituteParams(key, template, params)
}
