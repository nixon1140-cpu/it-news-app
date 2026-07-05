"use client";

import { useEffect, useState } from "react";

import { ArticleDashboard } from "@/components/article-dashboard";
import { ArticleGridSkeleton } from "@/components/article-grid-skeleton";
import { useBookmarkStore } from "@/lib/store/bookmark-store";
import type { Article } from "@/lib/types/article";

export function BookmarksView({ articles }: { articles: Article[] }) {
  const [mounted, setMounted] = useState(false);
  const bookmarkedIds = useBookmarkStore((state) => state.bookmarkedIds);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <ArticleGridSkeleton />;
  }

  const bookmarkedArticles = articles.filter((article) =>
    bookmarkedIds.includes(article.id)
  );

  return (
    <ArticleDashboard
      articles={bookmarkedArticles}
      emptyMessage="ブックマークした記事はまだありません。記事カードのブックマークアイコンから追加できます。"
    />
  );
}
