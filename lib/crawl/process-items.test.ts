import { describe, expect, it } from "vitest";

import { processItems, TimeBudgetExhaustedError, type TimeBudget } from "./process-items";

const SECOND = 1000;
const MINUTE = 60 * SECOND;

// 手動で進められる時計。
function makeClock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => void (t += ms) };
}

describe("processItems", () => {
  it("上限前に全件終われば truncated=false", async () => {
    const clock = makeClock();
    const result = await processItems(["a", "b", "c"], async () => {}, {
      startedAt: 0,
      now: clock.now,
      maxRunMs: 10 * MINUTE,
    });
    expect(result).toEqual({ saved: 3, failed: 0, unprocessed: 0, truncated: false });
  });

  it("1件の失敗は数えて続行する", async () => {
    const clock = makeClock();
    const result = await processItems(
      ["a", "b", "c"],
      async (item) => {
        if (item === "b") throw new Error("boom");
      },
      { startedAt: 0, now: clock.now, maxRunMs: 10 * MINUTE }
    );
    expect(result).toEqual({ saved: 2, failed: 1, unprocessed: 0, truncated: false });
  });

  it("失敗した記事だけ onError が呼ばれる（未処理の打ち切りでは呼ばれない）", async () => {
    const clock = makeClock();
    const errors: string[] = [];
    await processItems(
      ["a", "b"],
      async (item, _i, budget) => {
        if (item === "a") throw new Error("boom");
        clock.advance(10 * MINUTE);
        budget.timeoutMs(5 * MINUTE); // 残りなし → 未処理として打ち切り
      },
      {
        startedAt: 0,
        now: clock.now,
        maxRunMs: 10 * MINUTE,
        onError: (item) => void errors.push(String(item)),
      }
    );
    expect(errors).toEqual(["a"]);
  });

  it("上限に達したら残りを処理せず truncated=true（保存済み分は残る）", async () => {
    const clock = makeClock();
    const handled: string[] = [];
    const result = await processItems(
      ["a", "b", "c", "d"],
      async (item) => {
        handled.push(item);
        clock.advance(4 * MINUTE); // 1件に4分かかる想定
      },
      { startedAt: 0, now: clock.now, maxRunMs: 10 * MINUTE }
    );
    // a:0→4分, b:4→8分, c: 残り2分(≥30秒)なので処理 → 12分, d: 残りがマイナスなので打ち切り
    expect(handled).toEqual(["a", "b", "c"]);
    expect(result).toEqual({ saved: 3, failed: 0, unprocessed: 1, truncated: true });
  });

  it("残り30秒未満なら次の記事を始めず打ち切る（30秒ちょうどは始める）", async () => {
    const clockA = makeClock(10 * MINUTE - 29 * SECOND);
    const a = await processItems(["x"], async () => {}, { startedAt: 0, now: clockA.now, maxRunMs: 10 * MINUTE });
    expect(a).toEqual({ saved: 0, failed: 0, unprocessed: 1, truncated: true });

    const clockB = makeClock(10 * MINUTE - 30 * SECOND);
    const b = await processItems(["x"], async () => {}, { startedAt: 0, now: clockB.now, maxRunMs: 10 * MINUTE });
    expect(b).toEqual({ saved: 1, failed: 0, unprocessed: 0, truncated: false });
  });

  it("Ollama 呼び出しごとに残り時間を計算し直し、再試行のたびに timeoutMs が縮む", async () => {
    const clock = makeClock();
    const timeouts: number[] = [];
    await processItems(
      ["a"],
      async (_item, _index, budget: TimeBudget) => {
        // 1回目の呼び出し（失敗して再試行する想定）と、2回目の再試行。
        timeouts.push(budget.timeoutMs(5 * MINUTE));
        clock.advance(2 * MINUTE);
        timeouts.push(budget.timeoutMs(5 * MINUTE));
      },
      { startedAt: 0, now: clock.now, maxRunMs: 6 * MINUTE }
    );
    expect(timeouts).toEqual([5 * MINUTE, 4 * MINUTE]); // 通常5分 → 残り4分に縮む
    expect(timeouts[1]).toBeLessThan(timeouts[0]);
  });

  it("通常のタイムアウトより残り時間が長いときは通常の値を使う", async () => {
    const clock = makeClock();
    let value = 0;
    await processItems(
      ["a"],
      async (_i, _n, budget) => {
        value = budget.timeoutMs(5 * MINUTE);
      },
      { startedAt: 0, now: clock.now, maxRunMs: 60 * MINUTE }
    );
    expect(value).toBe(5 * MINUTE);
  });

  it("呼び出しの直前に残り30秒未満なら Ollama を呼ばず、その記事は失敗に数えず未処理にする", async () => {
    const clock = makeClock();
    let ollamaCalls = 0;
    const result = await processItems(
      ["a", "b"],
      async (item, _n, budget) => {
        if (item === "a") {
          budget.timeoutMs(5 * MINUTE);
          ollamaCalls++;
          clock.advance(9 * MINUTE + 45 * SECOND); // 残り15秒に
          // 再試行しようとして残り時間不足 → 呼ばずに打ち切り
          budget.timeoutMs(5 * MINUTE);
          ollamaCalls++;
        }
      },
      { startedAt: 0, now: clock.now, maxRunMs: 10 * MINUTE }
    );
    expect(ollamaCalls).toBe(1);
    expect(result).toEqual({ saved: 0, failed: 0, unprocessed: 2, truncated: true });
  });

  it("TimeBudgetExhaustedError は通常の失敗として数えられない", () => {
    expect(new TimeBudgetExhaustedError()).toBeInstanceOf(Error);
  });
});
