// ローカルLLM（Ollama）への接続クライアント。
// Node.js環境でのIPv6（::1）解決エラーを避けるため、127.0.0.1を明示する。
const OLLAMA_ENDPOINT = "http://127.0.0.1:11434/api/generate";
// クローラーと同じモデル。以前の既定値(llama3.1:8b)は無限反復バグが報告されているため変更した。
const DEFAULT_OLLAMA_MODEL = "gemma4:e4b-it-q4_K_M";
// 出力途中での切断（Unterminated string等のJSONパースエラー）を防ぐための
// 十分な最大出力トークン数。
const DEFAULT_NUM_PREDICT = 2048;
// モデルをメモリに常駐させる時間。クローラーは1日3回の実行間隔があるため30分とした。
const DEFAULT_KEEP_ALIVE = "30m";
// CPU推論では1記事あたり約2分半かかるため、余裕を持って5分とする。
const DEFAULT_TIMEOUT_MS = 300_000;
// リトライ: 接続エラーとHTTP 5xxのみ。最大3回試行し、待機の合計は60秒を超えない。
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 2_000;
const MAX_TOTAL_BACKOFF_MS = 60_000;

export interface GenerateJsonOptions {
  model?: string;
  system?: string;
  // "json" のシンプル指定、またはOllamaの構造化出力用JSON Schemaオブジェクトを渡せる。
  format?: string | Record<string, unknown>;
  numPredict?: number;
  keepAlive?: string;
  timeoutMs?: number;
  // テスト用の差し替え口（通常は指定しない）。
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
}

export class OllamaConnectionError extends Error {}
export class OllamaTimeoutError extends Error {}
export class OllamaHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

// 構造化ログ（JSON1行）。キーや本文は出さず、種別と状況だけを記録する。
export function logEvent(level: "INFO" | "WARNING" | "ERROR", message: string, extra: Record<string, unknown> = {}) {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    logger_name: "ollama.client",
    message,
    ...extra,
  });
  (level === "ERROR" ? console.error : console.warn)(line);
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function requestOnce(
  body: string,
  timeoutMs: number,
  fetchImpl: typeof fetch
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetchImpl(OLLAMA_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new OllamaTimeoutError(`Ollama API タイムアウト（${timeoutMs}ms）`);
    }
    throw new OllamaConnectionError(`Ollama API に接続できません: ${(error as Error).name}`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new OllamaHttpError(res.status, `Ollama API エラー: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data.response as string;
}

export async function generateJson(
  prompt: string,
  options: GenerateJsonOptions = {}
): Promise<string> {
  const model = options.model ?? DEFAULT_OLLAMA_MODEL;
  const body = JSON.stringify({
    model,
    prompt,
    ...(options.system ? { system: options.system } : {}),
    format: options.format ?? "json",
    stream: false,
    keep_alive: options.keepAlive ?? DEFAULT_KEEP_ALIVE,
    options: {
      num_predict: options.numPredict ?? DEFAULT_NUM_PREDICT,
    },
  });
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleepImpl ?? defaultSleep;

  let totalBackoff = 0;
  for (let attempt = 1; ; attempt++) {
    try {
      return await requestOnce(body, timeoutMs, fetchImpl);
    } catch (error) {
      // タイムアウトと4xxは再試行しても改善しないため、即座に呼び出し元へ返す。
      const retryable =
        error instanceof OllamaConnectionError ||
        (error instanceof OllamaHttpError && error.status >= 500);
      const backoff = Math.min(BASE_BACKOFF_MS * 2 ** (attempt - 1), MAX_TOTAL_BACKOFF_MS - totalBackoff);
      const exhausted = attempt >= MAX_ATTEMPTS || totalBackoff + backoff > MAX_TOTAL_BACKOFF_MS;

      if (!retryable || exhausted) {
        logEvent("ERROR", "Ollama呼び出しに失敗しました", {
          model,
          attempt,
          error_type: (error as Error).constructor.name,
          exc_info: (error as Error).message,
        });
        throw error;
      }

      logEvent("WARNING", "Ollama呼び出しに失敗したため再試行します", {
        model,
        attempt,
        wait_ms: backoff,
        error_type: (error as Error).constructor.name,
      });
      totalBackoff += backoff;
      await sleep(backoff);
    }
  }
}

export function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    return fenced[1].trim();
  }

  // 思考過程の断片など、JSON本体の前後に余分なテキストが混入する場合に備えて、
  // 最初の "{" から最後の "}" までを本体として抜き出す。
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1).trim();
  }

  return text.trim();
}
