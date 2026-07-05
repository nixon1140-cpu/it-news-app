"use server";

import { supabase } from "@/lib/supabase/client";
import type { Article, PriorityLabel } from "@/lib/types/article";

export interface GetArticlesResult {
  articles: Article[];
  error: string | null;
}

// カード上の優先度タグ（最重要/重要/低）と表示順を一致させるためのランク。
// importance（1〜5の数値）はLLM推論ごとにpriority_labelとずれ得るため、並び替えの主キーには使わない。
const PRIORITY_RANK: Record<PriorityLabel, number> = { High: 3, Mid: 2, Low: 1 };

/**
 * 優先順位ファースト（priority_label: High -> Mid -> Low -> published_at降順）で記事一覧を取得する。
 */
export async function getArticles(): Promise<GetArticlesResult> {
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .order("published_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    return { articles: [], error: error.message };
  }

  const articles = ((data ?? []) as Article[]).slice().sort((a, b) => {
    const rankDiff = PRIORITY_RANK[b.priority_label] - PRIORITY_RANK[a.priority_label];
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
  });

  return { articles, error: null };
}
