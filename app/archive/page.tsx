import { ArticleDashboard } from "@/components/article-dashboard";
import { getArticles } from "@/lib/api/articles";
import { splitArticlesByRecency } from "@/lib/utils/article-recency";

export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const { articles, error } = await getArticles();

  // ダッシュボード（直近1週間）から溢れた、それより前の記事のみを表示する。
  const { archived } = splitArticlesByRecency(articles);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-1.5">
        <p className="eyebrow">公開から1週間以上経過した記事</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance md:text-4xl">
          過去のニュース
        </h1>
      </div>
      {error ? (
        <p className="text-sm text-destructive">
          記事の取得に失敗しました: {error}
        </p>
      ) : (
        <ArticleDashboard
          articles={archived}
          emptyMessage="過去のニュースはまだありません。"
        />
      )}
    </div>
  );
}
