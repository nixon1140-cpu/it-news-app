import { SKIP_IF_SUCCESS_WITHIN_MS, STALE_AFTER_MS } from "./types";

export type RunDecision =
  | { run: true; reason: "no_recent_success" }
  | { run: false; reason: "recent_success" | "already_running" };

export interface DecideRunInput {
  now: Date;
  // 直近の success の終了時刻（無ければ null）
  latestSuccessFinishedAt: Date | null;
  // 現在 running の行の開始時刻（無ければ null）
  runningStartedAt: Date | null;
}

// start-app.bat のスキップ判定。
// 開始から2時間未満の running があれば実行中なのでスキップ（2時間以上は異常終了として無視）。
// 直近12時間未満に success があればスキップ。ちょうど12時間前なら実行する。
export function decideRun({ now, latestSuccessFinishedAt, runningStartedAt }: DecideRunInput): RunDecision {
  if (runningStartedAt && now.getTime() - runningStartedAt.getTime() < STALE_AFTER_MS) {
    return { run: false, reason: "already_running" };
  }
  if (latestSuccessFinishedAt && now.getTime() - latestSuccessFinishedAt.getTime() < SKIP_IF_SUCCESS_WITHIN_MS) {
    return { run: false, reason: "recent_success" };
  }
  return { run: true, reason: "no_recent_success" };
}
