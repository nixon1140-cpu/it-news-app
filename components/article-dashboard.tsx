"use client";

import { useMemo, useState } from "react";

import { ArticleCard } from "@/components/article-card";
import { ArticleDetailDialog } from "@/components/article-detail-dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Article, PriorityLabel } from "@/lib/types/article";

interface ArticleDashboardProps {
  articles: Article[];
  emptyMessage?: string;
}

type PriorityFilter = "All" | PriorityLabel;

const PRIORITY_FILTERS: { value: PriorityFilter; label: string }[] = [
  { value: "All", label: "すべて" },
  { value: "High", label: "最重要" },
  { value: "Mid", label: "重要" },
  { value: "Low", label: "低" },
];

// 優先度セクションの見出し表示順。
const PRIORITY_SECTIONS: { value: PriorityLabel; label: string }[] = [
  { value: "High", label: "最重要" },
  { value: "Mid", label: "重要" },
  { value: "Low", label: "低" },
];

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Badge
      onClick={onClick}
      className={cn(
        "cursor-pointer select-none border-transparent px-3 py-1 text-xs transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      {children}
    </Badge>
  );
}

export function ArticleDashboard({
  articles,
  emptyMessage = "表示できる記事がありません。",
}: ArticleDashboardProps) {
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [open, setOpen] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");

  const categories = useMemo(() => {
    return Array.from(new Set(articles.map((article) => article.category))).sort();
  }, [articles]);

  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      if (priorityFilter !== "All" && article.priority_label !== priorityFilter) {
        return false;
      }
      if (categoryFilter !== "All" && article.category !== categoryFilter) {
        return false;
      }
      return true;
    });
  }, [articles, priorityFilter, categoryFilter]);

  if (articles.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const handleCardClick = (article: Article) => {
    setSelectedArticle(article);
    setOpen(true);
  };

  // 優先度が「すべて」の場合のみ、最重要/重要/低のセクションに分けて表示する。
  // 特定の優先度に絞り込んでいる場合は単一グリッドで十分なため分割しない。
  const sections =
    priorityFilter === "All"
      ? PRIORITY_SECTIONS.map((section) => ({
          ...section,
          articles: filteredArticles.filter(
            (article) => article.priority_label === section.value
          ),
        })).filter((section) => section.articles.length > 0)
      : [
          {
            value: priorityFilter,
            label: "",
            articles: filteredArticles,
          },
        ];

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">優先度:</span>
          {PRIORITY_FILTERS.map((filter) => (
            <FilterChip
              key={filter.value}
              active={priorityFilter === filter.value}
              onClick={() => setPriorityFilter(filter.value)}
            >
              {filter.label}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">カテゴリ:</span>
          <FilterChip active={categoryFilter === "All"} onClick={() => setCategoryFilter("All")}>
            すべて
          </FilterChip>
          {categories.map((category) => (
            <FilterChip
              key={category}
              active={categoryFilter === category}
              onClick={() => setCategoryFilter(category)}
            >
              {category}
            </FilterChip>
          ))}
        </div>
      </div>

      {filteredArticles.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          条件に一致する記事がありません。
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-6">
          {sections.map((section) => (
            <div key={section.value} className="flex flex-col gap-3">
              {section.label && (
                <h2 className="text-sm font-semibold text-muted-foreground">
                  {section.label}
                  <span className="ml-2 text-xs font-normal">
                    ({section.articles.length}件)
                  </span>
                </h2>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {section.articles.map((article) => (
                  <ArticleCard key={article.id} article={article} onClick={handleCardClick} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <ArticleDetailDialog
        article={selectedArticle}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
