import { BookmarksView } from "@/components/bookmarks-view";
import { getArticles } from "@/lib/api/articles";

export const dynamic = "force-dynamic";

export default async function BookmarksPage() {
  const { articles, error } = await getArticles();

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-1.5">
        <p className="eyebrow">保存済みの記事</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance md:text-4xl">
          ブックマーク
        </h1>
      </div>
      {error ? (
        <p className="text-sm text-destructive">
          記事の取得に失敗しました: {error}
        </p>
      ) : (
        <BookmarksView articles={articles} />
      )}
    </div>
  );
}
