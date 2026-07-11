"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ExternalLink, Sparkles } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useModeStore } from "@/lib/store/mode-store";
import { AI_SERVICES, useHandoffStore, type AiServiceId } from "@/lib/store/handoff-store";
import { cn } from "@/lib/utils";
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

  // ハイドレーション対策: article-card.tsx のブックマーク表示と同じパターン。
  // SSR時点ではpersisted値を反映せず、マウント後にのみ実際のストア値を使う。
  const [mounted, setMounted] = useState(false);
  const handoffService = useHandoffStore((state) => state.service);
  const setHandoffService = useHandoffStore((state) => state.setService);

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectedServiceId: AiServiceId = mounted ? handoffService : "gemini";
  const selectedService =
    AI_SERVICES.find((service) => service.id === selectedServiceId) ?? AI_SERVICES[0];

  if (!article) return null;

  const action = isEnterprise ? article.action_enterprise : article.action_individual;

  const handleDeepAnalysisHandoff = async () => {
    const prompt = buildDeepAnalysisPrompt(article);

    window.open(selectedService.url, "_blank");

    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("プロンプトをコピーしました", {
        description: `開いた${selectedService.label}の画面でペースト（Ctrl+V）してください。`,
      });
    } catch (err) {
      toast.error("プロンプトのコピーに失敗しました", {
        description: `${selectedService.label}のタブは開きました。お手数ですが手動でコピーしてください。(${(err as Error).message})`,
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
              この記事の深掘り分析用プロンプトをクリップボードにコピーし、{selectedService.label}
              の公式Web画面を新しいタブで開きます。開いた画面に貼り付けて（Ctrl+V）実行してください。
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  {selectedService.label}
                  <ChevronDown className="size-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuRadioGroup
                    value={selectedServiceId}
                    onValueChange={(value) => setHandoffService(value as AiServiceId)}
                  >
                    {AI_SERVICES.map((service) => (
                      <DropdownMenuRadioItem key={service.id} value={service.id}>
                        {service.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={handleDeepAnalysisHandoff}>
                <Sparkles className="size-4" />✨ {selectedService.label}(Web)で深掘り分析
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
