"use client";

import { useEffect, useState } from "react";
import { Bookmark, Building2, ExternalLink, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useBookmarkStore } from "@/lib/store/bookmark-store";
import { useModeStore } from "@/lib/store/mode-store";
import type { Article, PriorityLabel } from "@/lib/types/article";

const PRIORITY_STYLES: Record<PriorityLabel, { text: string; className: string }> = {
  High: {
    text: "最重要",
    className:
      "border-transparent bg-primary text-primary-foreground shadow-[0_0_10px_color-mix(in_oklch,var(--primary)_55%,transparent)]",
  },
  Mid: {
    text: "重要",
    className: "border-transparent bg-amber-500 text-black",
  },
  Low: {
    text: "低",
    className: "border-border bg-muted text-muted-foreground",
  },
};

interface ArticleCardProps {
  article: Article;
  onClick?: (article: Article) => void;
}

export function ArticleCard({ article, onClick }: ArticleCardProps) {
  const priority = PRIORITY_STYLES[article.priority_label];
  const mode = useModeStore((state) => state.mode);
  const isEnterprise = mode === "enterprise";
  const action = isEnterprise ? article.action_enterprise : article.action_individual;

  const [mounted, setMounted] = useState(false);
  const bookmarked = useBookmarkStore((state) => state.isBookmarked(article.id));
  const toggleBookmark = useBookmarkStore((state) => state.toggleBookmark);

  useEffect(() => {
    setMounted(true);
  }, []);

  const showBookmarked = mounted && bookmarked;

  return (
    <Card
      onClick={() => onClick?.(article)}
      className={cn(
        "flex h-full flex-col cursor-pointer transition-colors hover:ring-primary/50",
        article.priority_label === "High" && "ring-primary/40"
      )}
    >
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <Badge className={priority.className}>{priority.text}</Badge>
          <span className="text-xs text-muted-foreground">{article.category}</span>
        </div>
        <CardTitle className="line-clamp-2 pr-6">{article.title}</CardTitle>
        <CardAction>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(event) => {
              event.stopPropagation();
              toggleBookmark(article.id);
            }}
            aria-label={showBookmarked ? "ブックマークを解除" : "ブックマークに追加"}
          >
            <Bookmark
              className={cn(
                "size-4",
                showBookmarked ? "fill-primary text-primary" : "text-muted-foreground"
              )}
            />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {new Date(article.published_at).toLocaleDateString("ja-JP")}
          </p>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
          >
            元記事を読む
            <ExternalLink className="size-3" />
          </a>
        </div>
        <div className="mt-auto flex items-start gap-2 rounded-md bg-accent p-2">
          {isEnterprise ? (
            <Building2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
          ) : (
            <User className="mt-0.5 size-3.5 shrink-0 text-primary" />
          )}
          <p className="line-clamp-3 text-xs text-accent-foreground">{action}</p>
        </div>
      </CardContent>
    </Card>
  );
}
