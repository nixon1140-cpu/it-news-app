import { describe, expect, it } from "vitest";

import { decideRun } from "./should-run";

const now = new Date("2026-11-02T12:00:00Z");
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

describe("decideRun（start-app.bat のスキップ判定）", () => {
  it("成功も実行中も無ければ実行する", () => {
    expect(decideRun({ now, latestSuccessFinishedAt: null, runningStartedAt: null })).toEqual({
      run: true,
      reason: "no_recent_success",
    });
  });

  it("12時間の境界: 11時間59分前の成功ならスキップ", () => {
    const result = decideRun({ now, latestSuccessFinishedAt: minutesAgo(11 * 60 + 59), runningStartedAt: null });
    expect(result).toEqual({ run: false, reason: "recent_success" });
  });

  it("12時間の境界: ちょうど12時間前なら実行する", () => {
    expect(decideRun({ now, latestSuccessFinishedAt: minutesAgo(12 * 60), runningStartedAt: null }).run).toBe(true);
  });

  it("12時間の境界: 12時間1分前の成功なら実行する", () => {
    expect(decideRun({ now, latestSuccessFinishedAt: minutesAgo(12 * 60 + 1), runningStartedAt: null }).run).toBe(true);
  });

  it("成功が無く失敗だけ（= latestSuccess が null）なら実行する", () => {
    expect(decideRun({ now, latestSuccessFinishedAt: null, runningStartedAt: null }).run).toBe(true);
  });

  it("2時間未満の running があればスキップ（1時間59分）", () => {
    const result = decideRun({ now, latestSuccessFinishedAt: null, runningStartedAt: minutesAgo(119) });
    expect(result).toEqual({ run: false, reason: "already_running" });
  });

  it("2時間以上経った running は無効として無視する（2時間1分）", () => {
    expect(decideRun({ now, latestSuccessFinishedAt: null, runningStartedAt: minutesAgo(121) }).run).toBe(true);
  });

  it("running の判定は成功の判定より優先する", () => {
    const result = decideRun({ now, latestSuccessFinishedAt: minutesAgo(60), runningStartedAt: minutesAgo(10) });
    expect(result).toEqual({ run: false, reason: "already_running" });
  });
});
