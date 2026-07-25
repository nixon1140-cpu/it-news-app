import { Suspense } from "react";

import { ArticleDashboard } from "@/components/article-dashboard";
import { ArticleGridSkeleton } from "@/components/article-grid-skeleton";
import { getArticles } from "@/lib/api/articles";

export const dynamic = "force-dynamic";

async function ArticlesSection() {
  const { articles, error } = await getArticles();

  if (error) {
    return (
      <p className="text-sm text-destructive">
        記事の取得に失敗しました: {error}
      </p>
    );
  }

  return <ArticleDashboard articles={articles} />;
}

export default function Home() {
  const dateline = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-1.5">
        <p className="eyebrow">本日のブリーフィング · {dateline}</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance md:text-4xl">
          ダッシュボード
        </h1>
      </div>
      <Suspense fallback={<ArticleGridSkeleton />}>
        <ArticlesSection />
      </Suspense>
    </div>
  );
}
