import { createSupabaseServer } from '@/lib/supabase/server';
import { levelsReachableFrom, type PracticeTopic, type PracticeTopicAreaSlug } from './topics';
import type { CefrLevel } from '@/lib/types/practice';

interface PracticeTopicRow {
  slug: string;
  area_slug: PracticeTopicAreaSlug;
  area_order: number;
  sort_order: number;
  min_cefr_level: CefrLevel;
  prompt_description: string;
}

const COLUMNS = 'slug, area_slug, area_order, sort_order, min_cefr_level, prompt_description';

function toTopic(row: PracticeTopicRow): PracticeTopic {
  return {
    slug: row.slug,
    areaSlug: row.area_slug,
    areaOrder: row.area_order,
    sortOrder: row.sort_order,
    minCefrLevel: row.min_cefr_level,
    promptDescription: row.prompt_description,
  };
}

/**
 * @param level - effective level of the student
 * @param slug - when given, restricts the read to that single topic
 * @returns active topics whose minimum level the student reaches, in one query; null on database error
 */
export async function fetchPracticeTopics(level: CefrLevel, slug?: string): Promise<PracticeTopic[] | null> {
  const supabase = await createSupabaseServer();
  let query = supabase
    .from('practice_topics')
    .select(COLUMNS)
    .eq('is_active', true)
    .in('min_cefr_level', levelsReachableFrom(level));
  if (slug) query = query.eq('slug', slug);
  const { data, error } = await query.order('area_order').order('sort_order');
  if (error || !data) return null;
  return (data as PracticeTopicRow[]).map(toTopic);
}
