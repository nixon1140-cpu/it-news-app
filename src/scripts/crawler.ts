// IT系RSSフィードから最新記事を取得し、ローカルLLM（Ollama / gemma4:e4b-it-q4_K_M）で
// 要点・行動提案を推論して Supabase の articles テーブルにUPSERTするバッチクローラー。
// 前提: Ollamaがローカルで起動し、`ollama pull gemma4:e4b-it-q4_K_M` 済みであること。
// 実行: npm run crawl
//
// 補足（モデル選定について）: 当初 llama3.1:8b を採用していたが、日本語のみの記事（翻訳ではなく
// 要約のみが必要なケース）で低頻度に同一文字列の無限反復ループへ陥り、出力が完全に破綻する
// 既知の不具合を実機で確認した。同一プロンプト・同一記事で gemma4:12b / qwen3.5:9b /
// gemma4:e4b-it-q4_K_M / gemma4:e2b-it-q4_K_M を比較した結果、いずれも正常な日本語を生成し、
// 特に gemma4:e4b-it-q4_K_M は llama3.1:8b と同等サイズながら安定した品質と高速性（約1/5の時間）を
// 両立したため、これを採用した。
import path from "node:path";
import dotenv from "dotenv";
import Parser from "rss-parser";
import { createClient } from "@supabase/supabase-js";

import { extractJson, generateJson } from "../../lib/ollama/client";
import type { Article, PriorityLabel } from "../../lib/types/article";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const OLLAMA_VERSION_ENDPOINT = "http://127.0.0.1:11434/api/version";

// Ollamaが起動していない状態で全記事の推論を試みて延々と失敗するのを防ぐため、
// 実行開始時に一度だけ疎通確認する。
async function ensureOllamaIsRunning(): Promise<void> {
  try {
    const res = await fetch(OLLAMA_VERSION_ENDPOINT);
    if (!res.ok) throw new Error(`status ${res.status}`);
  } catch {
    throw new Error(
      "Ollamaに接続できません（http://127.0.0.1:11434）。Ollamaが起動していない可能性があります。" +
        "タスクスケジューラの自動起動設定、または手動で `ollama serve` を実行してから再度お試しください。"
    );
  }
}

const RSS_FEEDS = [
  { name: "Zenn", url: "https://zenn.dev/feed", category: "General" },
  { name: "Qiita", url: "https://qiita.com/popular-items/feed", category: "General" },
  { name: "はてなブックマーク(IT)", url: "https://b.hatena.ne.jp/hotentry/it.rss", category: "General" },
  // AI業界の一次情報・高信頼性メディアを追加。
  { name: "Google AI Blog", url: "http://blog.research.google/feeds/posts/default?alt=rss", category: "AI" },
  { name: "ITmedia AI+", url: "https://rss.itmedia.co.jp/rss/2.0/aiplus.xml", category: "AI" },
  { name: "TechCrunch AI", url: "https://techcrunch.com/category/artificial-intelligence/feed/", category: "AI" },
];
const TOTAL_ARTICLE_FETCH_COUNT = 18;
const FEED_TIMEOUT_MS = 10000;
// 古い記事（アーカイブ記事等）が紛れ込むのを防ぐための足切りライン。
const MAX_ARTICLE_AGE_DAYS = 30;
const MAX_ARTICLE_AGE_MS = MAX_ARTICLE_AGE_DAYS * 24 * 60 * 60 * 1000;

const OLLAMA_MODEL = "gemma4:e4b-it-q4_K_M";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です。");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// AIに渡す本文抜粋の最大文字数。長すぎるとローカルLLMの推論が遅くなるため適度に切り詰める。
const MAX_EXCERPT_LENGTH = 600;

interface FeedItem {
  title: string;
  url: string;
  category: string;
  // RSS側の実際の公開日時。優先順位ソートの第2キー（新しい順）に使う。
  publishedAt: string;
  // 記事本文の抜粋。タイトルだけでは情報量が乏しく、AIが要約を「創作」して
  // 支離滅裂な文章になるのを防ぐため、可能な限り本文の一部を渡す。
  excerpt: string;
}

interface AIInference {
  title: string;
  summary: string;
  trend_diff: string;
  action_individual: string;
  action_enterprise: string;
  category: string;
  priority_label: PriorityLabel;
  importance: number;
}

async function fetchLatestArticles(): Promise<FeedItem[]> {
  // timeoutを指定し、サーバーダウン等によるハング（クローラー全体の停止）を防ぐ。
  const parser = new Parser({ timeout: FEED_TIMEOUT_MS });
  const perFeedLimit = Math.ceil(TOTAL_ARTICLE_FETCH_COUNT / RSS_FEEDS.length);
  const collected: FeedItem[] = [];
  const seenUrls = new Set<string>();
  const now = Date.now();

  for (const feedSource of RSS_FEEDS) {
    // 1フィードの取得失敗が他のフィード取得に影響しないよう、ループ内で独立してtry-catchする。
    try {
      const feed = await parser.parseURL(feedSource.url);
      let acceptedCount = 0;
      let skippedOldCount = 0;

      for (const item of feed.items ?? []) {
        if (acceptedCount >= perFeedLimit) break;
        if (!item.title || !item.link) continue;
        if (seenUrls.has(item.link)) continue;

        const rawDate = item.isoDate ?? item.pubDate;
        const parsedDate = rawDate ? new Date(rawDate) : null;
        const hasValidDate = parsedDate && !Number.isNaN(parsedDate.getTime());

        // 古い記事（30日以上前）は推論・保存に進まずスキップする。
        if (hasValidDate && now - parsedDate.getTime() > MAX_ARTICLE_AGE_MS) {
          skippedOldCount += 1;
          continue;
        }

        const publishedAt = hasValidDate ? parsedDate.toISOString() : new Date().toISOString();
        const rawExcerpt = (item.contentSnippet ?? item.content ?? "").trim();
        const excerpt = rawExcerpt.slice(0, MAX_EXCERPT_LENGTH);

        seenUrls.add(item.link);
        collected.push({
          title: item.title,
          url: item.link,
          category: feedSource.category,
          publishedAt,
          excerpt,
        });
        acceptedCount += 1;
      }

      console.log(
        `  ${feedSource.name}: ${acceptedCount}件取得${skippedOldCount > 0 ? `（古い記事${skippedOldCount}件をスキップ）` : ""}`
      );
    } catch (error) {
      console.error(`  ${feedSource.name}の取得に失敗したためスキップします: ${(error as Error).message}`);
    }
  }

  return collected.slice(0, TOTAL_ARTICLE_FETCH_COUNT);
}

const PRIORITY_LABEL_MAP: Record<string, PriorityLabel> = {
  最重要: "High",
  重要: "Mid",
  低: "Low",
  High: "High",
  Mid: "Mid",
  Low: "Low",
};

function normalizePriorityLabel(value: string): PriorityLabel {
  return PRIORITY_LABEL_MAP[value] ?? "Mid";
}

// importance_score（1〜10、モデル指定）をDBの importance（1〜5）に変換する。
function scoreToImportance(score: number): number {
  return Math.min(5, Math.max(1, Math.round(score / 2)));
}

// priority_labelが得られない場合に importance_score から導出するフォールバック。
function scoreToPriorityLabel(score: number): PriorityLabel {
  if (score >= 8) return "High";
  if (score >= 4) return "Mid";
  return "Low";
}

const ALLOWED_CATEGORIES = [
  "AI",
  "Cloud",
  "Frontend",
  "Backend",
  "Infrastructure",
  "Security",
  "General",
];

function normalizeCategory(value: string | undefined, fallback: string): string {
  if (value && ALLOWED_CATEGORIES.includes(value)) {
    return value;
  }
  return fallback;
}

const SYSTEM_PROMPT =
  "あなたは優秀な技術翻訳・要約アシスタントです。入力記事を指定されたJSONスキーマに従って【必ずすべて日本語で】出力してください。";

// 補足: Ollamaの「format」に厳格なJSON Schema（構造化出力／グラマー制約デコード）を
// 直接渡す方式を検証したが、llama3.1:8b / gemma4:12b いずれでも、日本語（マルチバイトUTF-8）
// 生成時に低頻度で文字列が破損する問題（Ollama/llama.cpp側のグラマーデコードの既知の弱点）が
// 実機テストで再現したため採用を見送った。代わりに format は緩やかな "json" モード（JSON妥当性のみ
// を強制し、バイト単位のグラマー制約は行わない）を使い、必須キーの欠落防止と日本語強制は
// プロンプト本文に明示的なJSONテンプレート＋指示を埋め込むことで担保する。
function buildInferencePrompt(item: FeedItem, extraReminder?: string): string {
  return `あなたはこれから記事を読み、以下のJSON形式で【必ずすべて日本語で】出力してください。
英語の単語・文章をそのまま出力することは禁止します。固有名詞（社名・サービス名等）以外は必ず日本語に翻訳してください。
キーを省略せず、必ず全てのキーを含めてください。
出力は必ず1行のJSONのみとし、文字列内に生の改行文字を含めないでください（改行が必要な場合は "\\n" のようにエスケープすること）。

出力JSON形式（このキー名・構造を厳守すること）:
{
  "title": "記事タイトルの日本語訳",
  "summary": "記事の要約（3〜4文、必ず日本語）",
  "importance_score": 1〜10の整数,
  "category": "AI, Cloud, Frontend, Backend, Infrastructure, Security, General のいずれか1つ",
  "action_plan": "ITエンジニアが取るべき具体的な行動提案（1〜2文、必ず日本語）",
  "trend_diff": "前回や既存技術からの変化・差分（1〜2文、必ず日本語）",
  "action_individual": "個人エンジニア向けの具体的な行動提案（必ず日本語）",
  "action_enterprise": "企業・チーム向けの具体的な行動提案（必ず日本語）",
  "priority_label": "High, Mid, Low のいずれか1つ（最重要=High, 重要=Mid, 低=Low）"
}

【対象記事（英語の場合あり）】
タイトル: ${item.title}
URL: ${item.url}
本文抜粋: ${item.excerpt || "（本文抜粋なし。タイトルの情報のみから推測して簡潔に出力してください）"}
${extraReminder ? `\n【重要】${extraReminder}\n` : ""}
summaryは上記の本文抜粋の内容に基づいて書いてください。本文抜粋がない場合のみタイトルから推測してください。憶測で無関係な内容を創作しないでください。
JSON以外の文章（前置き・説明・コードブロック記号）は一切出力せず、JSONオブジェクトのみを出力してください。`;
}

// タイトル・要約等に英単語がそのまま残っていないか（翻訳漏れ）を簡易判定する。
// 日本語（ひらがな・カタカナ・漢字）がほぼ無く、アルファベットの比率が高い場合を英語混入とみなす。
function looksUntranslated(inference: Pick<AIInference, "title" | "summary">): boolean {
  const text = `${inference.title}${inference.summary}`;
  if (text.length < 8) return false;
  const japaneseChars = text.match(/[぀-ヿ㐀-鿿]/g)?.length ?? 0;
  const asciiLetters = text.match(/[A-Za-z]/g)?.length ?? 0;
  return japaneseChars < text.length * 0.2 && asciiLetters > text.length * 0.4;
}

async function requestInference(prompt: string): Promise<Record<string, unknown>> {
  const raw = await generateJson(prompt, {
    model: OLLAMA_MODEL,
    system: SYSTEM_PROMPT,
    format: "json",
  });
  return JSON.parse(extractJson(raw));
}

function toInference(item: FeedItem, parsed: Record<string, unknown>): AIInference {
  const importanceScore = Number(parsed.importance_score) || 5;
  const actionPlan = String(parsed.action_plan ?? "");

  return {
    title: String(parsed.title ?? item.title) || item.title,
    summary: String(parsed.summary ?? ""),
    trend_diff: String(parsed.trend_diff ?? ""),
    action_individual: String(parsed.action_individual ?? actionPlan),
    action_enterprise: String(parsed.action_enterprise ?? actionPlan),
    category: normalizeCategory(parsed.category as string | undefined, item.category),
    priority_label: parsed.priority_label
      ? normalizePriorityLabel(String(parsed.priority_label))
      : scoreToPriorityLabel(importanceScore),
    importance: scoreToImportance(importanceScore),
  };
}

const MAX_INFERENCE_ATTEMPTS = 2;

async function inferArticleDetails(item: FeedItem): Promise<AIInference> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_INFERENCE_ATTEMPTS; attempt++) {
    try {
      // JSON解析に失敗した直後の再試行では、改行・壊れた文字列を避けるよう念押しする。
      const extraReminder =
        attempt > 1
          ? "前回の出力はJSONとして不正でした。必ず有効な1行のJSONのみを出力してください。"
          : undefined;
      const parsed = await requestInference(buildInferencePrompt(item, extraReminder));
      const inference = toInference(item, parsed);

      // 翻訳漏れ（英語のまま）を検出した場合、日本語化を強く念押しして1回だけ再試行する。
      if (looksUntranslated(inference) && attempt < MAX_INFERENCE_ATTEMPTS) {
        const retryParsed = await requestInference(
          buildInferencePrompt(
            item,
            "前回の出力は英語のままでした。title・summary・action_plan等は必ず自然な日本語に翻訳し直してください。"
          )
        );
        return toInference(item, retryParsed);
      }

      return inference;
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw lastError ?? new Error("推論に失敗しました。");
}

async function upsertArticle(item: FeedItem, inference: AIInference) {
  const record: Omit<Article, "id"> = {
    title: inference.title,
    url: item.url,
    category: inference.category,
    published_at: item.publishedAt,
    summary: inference.summary,
    trend_diff: inference.trend_diff,
    action_individual: inference.action_individual,
    action_enterprise: inference.action_enterprise,
    priority_label: inference.priority_label,
    importance: inference.importance,
  };

  const { error } = await supabase
    .from("articles")
    .upsert(record, { onConflict: "url" });

  if (error) {
    throw new Error(`Supabase upsert失敗 (${item.url}): ${error.message}`);
  }
}

async function main() {
  await ensureOllamaIsRunning();

  console.log(`RSS取得中: ${RSS_FEEDS.map((f) => f.name).join(", ")}`);
  const items = await fetchLatestArticles();
  console.log(`${items.length}件の記事を取得しました。`);

  for (const [index, item] of items.entries()) {
    console.log(`[${index + 1}/${items.length}] 推論中(Ollama/${OLLAMA_MODEL}): ${item.title}`);

    try {
      const inference = await inferArticleDetails(item);
      await upsertArticle(item, inference);
      console.log(`  -> 保存完了 (priority=${inference.priority_label}, importance=${inference.importance})`);
    } catch (error) {
      console.warn(`  -> 推論または保存に失敗したためスキップします: ${(error as Error).message}`);
    }
  }

  console.log("クローラー処理が完了しました。");
}

main().catch((error) => {
  console.error("クローラー実行中にエラーが発生しました:", error);
  process.exit(1);
});
