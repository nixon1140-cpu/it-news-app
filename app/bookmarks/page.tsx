import { BookmarksView } from "@/components/bookmarks-view";
import { getArticles } from "@/lib/api/articles";

export const dynamic = "force-dynamic";

export default async function BookmarksPage() {
  const { articles, error } = await getArticles();

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">ブックマーク</h1>
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
