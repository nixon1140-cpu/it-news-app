import { NextResponse } from "next/server";

import { extractJson, generateJson } from "@/lib/ollama/client";
import { supabase } from "@/lib/supabase/client";

// ローカルLLMは応答時間が安定せずビルド時の静的生成（ISR）に向かないため、
// 常に動的レンダリングとし、下記の自前キャッシュでOllamaへの呼び出し回数を抑える。
export const dynamic = "force-dynamic";

const CACHE_DURATION_MS = 43200 * 1000; // 12時間

interface TrendItem {
  trend_title: string;
  description: string;
  action_advice: string;
}

// プロセスが再起動するとリセットされるが、ローカルLLMへの呼び出し回数を
// 抑えるための簡易キャッシュとして保持する。
let cache: { trends: TrendItem[]; cachedAt: number } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.cachedAt < CACHE_DURATION_MS) {
    return NextResponse.json({ trends: cache.trends, cached: true });
  }

  const { data: articles, error } = await supabase
    .from("articles")
    .select("title, summary")
    .order("importance", { ascending: false })
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!articles || articles.length === 0) {
    return NextResponse.json({ trends: [] satisfies TrendItem[] });
  }

  const newsDigest = articles
    .map(
      (article, index) =>
        `${index + 1}. ${article.title}\n要約: ${article.summary}`
    )
    .join("\n\n");

  const prompt = `あなたはIT業界のトレンドアナリストです。以下のニュース記事群から、現在IT業界で起きているマクロなトレンドを3つ抽出してください。

${newsDigest}

次のJSON形式で回答してください:
{
  "trends": [
    {
      "trend_title": "トレンドの名称",
      "description": "トレンドの説明（2〜3文）",
      "action_advice": "エンジニア向けの具体的な行動アドバイス"
    }
  ]
}
trendsは必ず3件にしてください。必ず指定されたJSONフォーマットのみを出力し、マークダウン（\`\`\`json）や前後の説明文を含めないこと。`;

  try {
    const raw = await generateJson(prompt);
    const parsed = JSON.parse(extractJson(raw));
    const trends: TrendItem[] = Array.isArray(parsed.trends)
      ? parsed.trends
      : [];

    cache = { trends, cachedAt: Date.now() };

    return NextResponse.json({ trends });
  } catch (err) {
    // ローカルLLMが起動していない等で失敗した場合、古いキャッシュがあればそれを返す。
    if (cache) {
      return NextResponse.json({ trends: cache.trends, cached: true, stale: true });
    }
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
