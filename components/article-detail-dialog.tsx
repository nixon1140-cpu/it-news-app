"use client";

import { ExternalLink, Sparkles } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useModeStore } from "@/lib/store/mode-store";
import type { Article } from "@/lib/types/article";

interface ArticleDetailDialogProps {
  article: Article | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function toBullets(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^[-・*]\s*/, "").trim())
    .filter(Boolean);
}

function buildDeepAnalysisPrompt(article: Article): string {
  return `あなたはシニアソフトウェアアーキテクトです。
以下のITニュースを読み、マクロな技術トレンドへの影響と、エンジニアが取るべきアクションを深く考察してください。
※元の記事が英語の場合でも、分析結果は【必ずすべて自然な日本語】で、Markdown形式で出力してください。
【タイトル】${article.title}
【URL】${article.url}
【要約】${article.summary}`;
}

export function ArticleDetailDialog({
  article,
  open,
  onOpenChange,
}: ArticleDetailDialogProps) {
  const mode = useModeStore((state) => state.mode);
  const isEnterprise = mode === "enterprise";

  if (!article) return null;

  const action = isEnterprise ? article.action_enterprise : article.action_individual;

  const handleDeepAnalysisHandoff = async () => {
    const prompt = buildDeepAnalysisPrompt(article);

    window.open("https://gemini.google.com/app", "_blank");

    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("プロンプトをコピーしました", {
        description: "開いたGeminiの画面でペースト（Ctrl+V）してください。",
      });
    } catch (err) {
      toast.error("プロンプトのコピーに失敗しました", {
        description: `Geminiのタブは開きました。お手数ですが手動でコピーしてください。(${(err as Error).message})`,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-4xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{article.category}</Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(article.published_at).toLocaleDateString("ja-JP")}
            </span>
          </div>
          <DialogTitle className="text-lg leading-snug">
            {article.title}
          </DialogTitle>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
          >
            元記事を読む
            <ExternalLink className="size-3" />
          </a>
        </DialogHeader>

        <Tabs defaultValue="summary" className="flex-1 overflow-y-auto">
          <TabsList className="w-full">
            <TabsTrigger value="summary">要約</TabsTrigger>
            <TabsTrigger value="diff">変化</TabsTrigger>
            <TabsTrigger value="action">行動提案</TabsTrigger>
            <TabsTrigger value="deep">
              <Sparkles className="size-3.5" />
              深掘り分析
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="pt-3">
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground">
              {toBullets(article.summary).map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="diff" className="pt-3">
            <p className="text-sm leading-relaxed text-foreground">
              {article.trend_diff}
            </p>
          </TabsContent>

          <TabsContent value="action" className="pt-3">
            <div className="space-y-2 rounded-md bg-accent p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-accent-foreground/80">
                {isEnterprise ? "ビジネス視点向け" : "エンジニア視点向け"}
              </h3>
              <p className="text-sm leading-relaxed text-accent-foreground">
                {action}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="deep" className="space-y-3 pt-3">
            <p className="text-sm leading-relaxed text-muted-foreground">
              この記事の深掘り分析用プロンプトをクリップボードにコピーし、Geminiの公式Web画面を新しいタブで開きます。開いた画面に貼り付けて（Ctrl+V）実行してください。
            </p>
            <Button onClick={handleDeepAnalysisHandoff}>
              <Sparkles className="size-4" />
              ✨ Gemini(Web)で深掘り分析
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
