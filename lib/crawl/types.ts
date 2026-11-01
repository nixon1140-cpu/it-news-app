// 収集などのバッチ処理の実行記録（crawl_runs）に関する共通の型と定数。

export type JobType = "crawl" | "metrics" | "digest";
export type RunStatus = "running" | "success" | "failed";

// running のまま残った行は、開始からこの時間を過ぎたら無効（異常終了とみなす）。
export const STALE_AFTER_MS = 2 * 60 * 60 * 1000;
// 1回の実行の全体上限。running の失効（2時間）より10分短くし、失効前に必ず終わらせる。
export const MAX_RUN_MS = 110 * 60 * 1000;
// Ollama を呼ぶ前の残り時間がこれ未満なら、呼ばずに打ち切る。
export const MIN_REMAINING_MS = 30 * 1000;
// start-app.bat のスキップ判定: 直近この時間以内に成功した収集があれば再実行しない。
export const SKIP_IF_SUCCESS_WITHIN_MS = 12 * 60 * 60 * 1000;

export const STALE_RUN_SUMMARY = "前回の実行が異常終了（2時間超過）";
export const TRUNCATED_SUMMARY = "時間上限で打ち切り";

export interface RunFinish {
  status: "success" | "failed";
  finishedAt: Date;
  successCount: number;
  failureCount: number;
  errorSummary: string | null;
}

// crawl_runs への操作の入れ口。本番は Supabase 版（run-store.ts）、テストは in-memory 版を使う。
export interface RunStore {
  // 開始が cutoff より前の running を failed にする。更新した件数を返す。
  expireStale(jobType: JobType, cutoff: Date): Promise<number>;
  // running 行を1つ作る。同じ種別の running が既にあれば null（一意制約違反）。
  tryInsertRunning(jobType: JobType, startedAt: Date): Promise<{ id: string } | null>;
  // 「自分の id かつ status='running'」の行だけ更新する。更新できたら true、0件なら false。
  finish(id: string, update: RunFinish): Promise<boolean>;
  // 直近の success（終了時刻の新しい順で1件）。
  latestSuccess(jobType: JobType): Promise<{ finishedAt: Date } | null>;
  // 現在の running（あれば開始時刻）。
  currentRunning(jobType: JobType): Promise<{ startedAt: Date } | null>;
}

// DB に記録できないときのローカルログの入れ口。書き込みに失敗しても例外を投げない。
export interface FallbackLogger {
  write(event: Record<string, unknown>): void;
}
