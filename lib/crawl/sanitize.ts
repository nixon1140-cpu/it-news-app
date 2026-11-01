// crawl_runs の error_summary に入れる文字列を安全にする。
// エラー本文（error.message）にはURL・キー・記事本文が混ざり得るため、使わない。
// 種類名と固定の短い文だけを組み立てる。

const MAX_SUMMARY_LENGTH = 200;

// クラス名ごとの固定文。ここに無い例外は種類名のみ。
const FIXED_MESSAGES: Record<string, string> = {
  OllamaConnectionError: "Ollamaに接続できませんでした",
  OllamaTimeoutError: "Ollamaの応答がタイムアウトしました",
  OllamaHttpError: "OllamaがHTTPエラーを返しました",
  OllamaModelNotFoundError: "Ollamaのモデルが見つかりません",
  TimeBudgetExhaustedError: "時間上限に達しました",
};

// 自由な文字列に含まれ得る秘密らしきものを伏せ字にし、長さを切り詰める。
export function sanitizeSummary(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, "****")
    .replace(/eyJ[A-Za-z0-9._-]*/g, "****")
    .replace(/[A-Za-z0-9_-]{20,}/g, "****")
    .slice(0, MAX_SUMMARY_LENGTH);
}

function safeErrorName(error: unknown): string {
  const raw = error instanceof Error ? error.constructor?.name || error.name : typeof error;
  // 識別子として妥当な名前だけ通す（それ以外は汎用名）。
  return /^[A-Za-z_][A-Za-z0-9_]{0,59}$/.test(raw) ? raw : "Error";
}

export function summarizeError(error: unknown): string {
  const name = safeErrorName(error);
  const fixed = FIXED_MESSAGES[name];
  return fixed ? `${name}: ${sanitizeSummary(fixed)}` : name;
}
