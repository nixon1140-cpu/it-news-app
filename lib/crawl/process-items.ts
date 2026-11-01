import { MAX_RUN_MS, MIN_REMAINING_MS } from "./types";

// 残り時間が足りず Ollama を呼べないときに投げる。その記事は失敗ではなく「未処理」として扱う。
export class TimeBudgetExhaustedError extends Error {
  constructor() {
    super("time budget exhausted");
  }
}

export interface TimeBudget {
  // 「Ollama 呼び出し1回ごと」に呼び直す。残りが最小値未満なら TimeBudgetExhaustedError を投げ、
  // そうでなければ「通常のタイムアウト」と「残り時間」の短い方（ms）を返す。
  timeoutMs(defaultMs: number): number;
}

export interface ProcessItemsOptions {
  startedAt: number;
  now?: () => number;
  maxRunMs?: number;
  minRemainingMs?: number;
}

export interface ProcessItemsResult {
  saved: number;
  failed: number;
  // 時間上限で処理しなかった（または途中で打ち切った）記事の数。failed には含めない。
  unprocessed: number;
  truncated: boolean;
}

// 記事を1件ずつ処理する。時間上限に達したら残りを打ち切り、保存済み分の件数を返す。
export async function processItems<T>(
  items: readonly T[],
  handler: (item: T, index: number, budget: TimeBudget) => Promise<void>,
  options: ProcessItemsOptions
): Promise<ProcessItemsResult> {
  const now = options.now ?? Date.now;
  const maxRunMs = options.maxRunMs ?? MAX_RUN_MS;
  const minRemainingMs = options.minRemainingMs ?? MIN_REMAINING_MS;
  const remaining = () => maxRunMs - (now() - options.startedAt);

  const budget: TimeBudget = {
    timeoutMs(defaultMs: number) {
      const left = remaining();
      if (left < minRemainingMs) {
        throw new TimeBudgetExhaustedError();
      }
      return Math.min(defaultMs, left);
    },
  };

  let saved = 0;
  let failed = 0;
  for (let index = 0; index < items.length; index++) {
    if (remaining() < minRemainingMs) {
      return { saved, failed, unprocessed: items.length - index, truncated: true };
    }
    try {
      await handler(items[index], index, budget);
      saved++;
    } catch (error) {
      if (error instanceof TimeBudgetExhaustedError) {
        return { saved, failed, unprocessed: items.length - index, truncated: true };
      }
      failed++;
    }
  }
  return { saved, failed, unprocessed: 0, truncated: false };
}
