import type { Article } from "@/lib/types/article";

// ダッシュボードが公開直近1週間の記事のみを表示し、それより前の記事を
// 「過去のニュース」（/archive）へ分離するための足切り日数。
const RECENT_ARTICLE_WINDOW_DAYS = 7;

/**
 * 記事一覧を「直近1週間以内」と「それより前（過去のニュース）」に分割する。
 * 優先度ソート・カテゴリフィルター等の既存ロジックには影響しない、
 * 表示対象の絞り込みのみを行う純粋関数。
 */
export function splitArticlesByRecency(
  articles: Article[],
  now: Date = new Date()
): { recent: Article[]; archived: Article[] } {
  const cutoffMs = now.getTime() - RECENT_ARTICLE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recent: Article[] = [];
  const archived: Article[] = [];

  for (const article of articles) {
    const publishedMs = new Date(article.published_at).getTime();
    if (!Number.isNaN(publishedMs) && publishedMs >= cutoffMs) {
      recent.push(article);
    } else {
      archived.push(article);
    }
  }

  return { recent, archived };
}
