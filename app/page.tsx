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
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">ダッシュボード</h1>
      <Suspense fallback={<ArticleGridSkeleton />}>
        <ArticlesSection />
      </Suspense>
    </div>
  );
}
