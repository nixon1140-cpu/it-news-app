import { summarizeError } from "./sanitize";
import {
  STALE_AFTER_MS,
  TRUNCATED_SUMMARY,
  type FallbackLogger,
  type JobType,
  type RunFinish,
  type RunStore,
} from "./types";

export type StartRunResult =
  | { kind: "started"; runId: string }
  | { kind: "skipped" } // 同じ種別が実行中なので、後から来た方はスキップ
  | { kind: "unavailable" }; // DB に記録できない（ローカルログに残した）

export interface RecorderDeps {
  fallback: FallbackLogger;
  now?: () => Date;
}

export async function startRun(
  store: RunStore,
  jobType: JobType,
  { fallback, now = () => new Date() }: RecorderDeps
): Promise<StartRunResult> {
  try {
    const startedAt = now();
    // 2時間を過ぎた running は異常終了として失効させてから、新しい running を作る。
    await store.expireStale(jobType, new Date(startedAt.getTime() - STALE_AFTER_MS));
    const inserted = await store.tryInsertRunning(jobType, startedAt);
    return inserted ? { kind: "started", runId: inserted.id } : { kind: "skipped" };
  } catch (error) {
    fallback.write({
      message: "実行開始をDBに記録できませんでした",
      job_type: jobType,
      error_type: summarizeError(error),
    });
    return { kind: "unavailable" };
  }
}

// 実行結果（致命的エラーの有無・件数）。
export interface RunResult {
  fetched: number; // RSS から取得できた記事数
  saved: number;
  failed: number;
  truncated: boolean;
  fatalError?: unknown;
}

export type RunOutcome = Omit<RunFinish, "finishedAt">;

// 成功・失敗の判定:
// - 致命的エラーがあれば failed
// - 1件以上保存できていれば success（一部の記事の失敗や、時間上限での打ち切りがあっても success）
// - 保存が0件なら failed（RSS取得0件・全件失敗・打ち切りで0件）
// error_summary はエラーの種類名と固定文だけ。error.message は使わない。
export function buildOutcome(result: RunResult): RunOutcome {
  if (result.fatalError !== undefined) {
    return {
      status: "failed",
      successCount: result.saved,
      failureCount: result.failed,
      errorSummary: summarizeError(result.fatalError),
    };
  }
  if (result.saved >= 1) {
    return {
      status: "success",
      successCount: result.saved,
      failureCount: result.failed,
      errorSummary: result.truncated ? TRUNCATED_SUMMARY : null,
    };
  }
  const reason =
    result.fetched === 0
      ? "RSS取得が0件"
      : result.truncated
        ? `${TRUNCATED_SUMMARY}（保存0件）`
        : "全件の処理に失敗";
  return { status: "failed", successCount: 0, failureCount: result.failed, errorSummary: reason };
}

// 終了を記録する。更新条件は「自分の id かつ running」（store.finish の責務）。
// 0件更新（失効済みなど）やDBエラーのときはローカルログに残し、false を返す。
export async function finishRun(
  store: RunStore,
  runId: string,
  outcome: RunOutcome,
  { fallback, now = () => new Date() }: RecorderDeps
): Promise<boolean> {
  const event = {
    run_id: runId,
    status: outcome.status,
    success_count: outcome.successCount,
    failure_count: outcome.failureCount,
    error_summary: outcome.errorSummary,
  };
  try {
    const updated = await store.finish(runId, { ...outcome, finishedAt: now() });
    if (!updated) {
      fallback.write({ message: "終了の記録が0件更新でした（失効済みの可能性）", ...event });
    }
    return updated;
  } catch (error) {
    fallback.write({
      message: "実行終了をDBに記録できませんでした",
      error_type: summarizeError(error),
      ...event,
    });
    return false;
  }
}
