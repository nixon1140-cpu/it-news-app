import {
  generateJson,
  logEvent,
  OllamaConnectionError,
  type GenerateJsonOptions,
} from "./client";

const TAGS_ENDPOINT = "http://127.0.0.1:11434/api/tags";
const TAGS_TIMEOUT_MS = 5_000;
// 起動直後のOllamaを待つ上限（start-app.batの待機上限と同じ120秒）。
const DEFAULT_WAIT_TIMEOUT_MS = 120_000;
const DEFAULT_POLL_INTERVAL_MS = 5_000;
// モデルのロード込みで確認するため、CPU推論でも十分な時間を取る。
const PROBE_TIMEOUT_MS = 180_000;

export class OllamaModelNotFoundError extends Error {
  constructor(public readonly model: string) {
    super(`Ollamaモデル '${model}' が見つかりません。'ollama pull ${model}' を実行してください。`);
  }
}

export interface WaitForOllamaOptions {
  waitTimeoutMs?: number;
  pollIntervalMs?: number;
  // テスト用の差し替え口（通常は指定しない）。
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// /api/tags を1回叩き、インストール済みモデル名の一覧を返す。接続できなければnull。
export async function fetchInstalledModels(
  fetchImpl: typeof fetch = fetch
): Promise<string[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TAGS_TIMEOUT_MS);
  try {
    const res = await fetchImpl(TAGS_ENDPOINT, { signal: controller.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as { models?: { name: string }[] };
    return (data.models ?? []).map((m) => m.name);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// クローラー起動時の確認。①Ollamaが応答するまで待つ ②モデルが入っているか確認
// ③最小の生成を1回行い、モデルが実際にロードできることを確認する。
// どれかに失敗した場合は、種類別の例外で明示的に失敗させる（サイレントにしない）。
export async function waitForOllamaReady(
  model: string,
  options: WaitForOllamaOptions = {}
): Promise<void> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleepImpl ?? defaultSleep;
  const interval = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const maxPolls = Math.max(1, Math.ceil((options.waitTimeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS) / interval));

  let installed: string[] | null = null;
  for (let poll = 1; poll <= maxPolls; poll++) {
    installed = await fetchInstalledModels(fetchImpl);
    if (installed) break;
    logEvent("WARNING", "Ollamaの応答を待っています", { poll, max_polls: maxPolls });
    if (poll < maxPolls) await sleep(interval);
  }
  if (!installed) {
    const error = new OllamaConnectionError(
      "Ollamaに接続できません（http://127.0.0.1:11434）。Ollamaが起動していない可能性があります。" +
        "Ollamaアプリを起動してから再度お試しください。"
    );
    logEvent("ERROR", "Ollamaの待機上限に達しました", { exc_info: error.message });
    throw error;
  }

  if (!installed.includes(model)) {
    const error = new OllamaModelNotFoundError(model);
    logEvent("ERROR", "Ollamaにモデルがありません", { model, exc_info: error.message });
    throw error;
  }

  const probeOptions: GenerateJsonOptions = {
    model,
    numPredict: 4,
    timeoutMs: PROBE_TIMEOUT_MS,
    fetchImpl,
    sleepImpl: sleep,
  };
  await generateJson("Reply with {}", probeOptions);
  logEvent("INFO", "Ollamaの準備を確認しました", { model });
}
