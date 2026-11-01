import { describe, expect, it } from "vitest";

import { OllamaConnectionError } from "../ollama/client";
import { createFileFallbackLogger } from "./fallback-log";
import { processItems } from "./process-items";
import { buildOutcome, finishRun, startRun } from "./run-recorder";
import { InMemoryRunStore } from "./testing/in-memory-run-store";
import { STALE_RUN_SUMMARY, type FallbackLogger } from "./types";

const t0 = new Date("2026-11-02T09:00:00Z");
const after = (ms: number) => new Date(t0.getTime() + ms);
const MINUTE = 60_000;

function makeFallback() {
  const events: Record<string, unknown>[] = [];
  const fallback: FallbackLogger = { write: (e) => void events.push(e) };
  return { fallback, events };
}

describe("buildOutcome（成功・失敗の判定）", () => {
  it("1件以上保存できれば success。一部失敗があっても success で、失敗件数を残す", () => {
    expect(buildOutcome({ fetched: 18, saved: 15, failed: 3, truncated: false })).toEqual({
      status: "success",
      successCount: 15,
      failureCount: 3,
      errorSummary: null,
    });
  });

  it("保存が0件なら failed（全件失敗）", () => {
    expect(buildOutcome({ fetched: 5, saved: 0, failed: 5, truncated: false })).toMatchObject({
      status: "failed",
      errorSummary: "全件の処理に失敗",
    });
  });

  it("RSS取得が0件なら failed", () => {
    expect(buildOutcome({ fetched: 0, saved: 0, failed: 0, truncated: false })).toMatchObject({
      status: "failed",
      errorSummary: "RSS取得が0件",
    });
  });

  it("致命的エラーは failed。要約は種類名と固定文だけで、メッセージ・キーを含まない", () => {
    const error = new OllamaConnectionError("connect failed http://127.0.0.1:11434 key=eyJsecret0123456789abcdef");
    const outcome = buildOutcome({ fetched: 18, saved: 0, failed: 0, truncated: false, fatalError: error });
    expect(outcome.status).toBe("failed");
    expect(outcome.errorSummary).toBe("OllamaConnectionError: Ollamaに接続できませんでした");
    expect(outcome.errorSummary).not.toContain("eyJ");
    expect(outcome.errorSummary).not.toContain("127.0.0.1");
  });
});

describe("startRun / finishRun", () => {
  it("開始→終了で success が記録される", async () => {
    const store = new InMemoryRunStore();
    const { fallback } = makeFallback();
    const started = await startRun(store, "crawl", { fallback, now: () => t0 });
    expect(started.kind).toBe("started");
    if (started.kind !== "started") return;

    const ok = await finishRun(store, started.runId, buildOutcome({ fetched: 3, saved: 3, failed: 0, truncated: false }), {
      fallback,
      now: () => after(10 * MINUTE),
    });
    expect(ok).toBe(true);
    expect(store.runs[0]).toMatchObject({ status: "success", successCount: 3, finishedAt: after(10 * MINUTE) });
  });

  it("実行中なら、後から来た方はスキップされる", async () => {
    const store = new InMemoryRunStore();
    const { fallback } = makeFallback();
    expect((await startRun(store, "crawl", { fallback, now: () => t0 })).kind).toBe("started");
    expect((await startRun(store, "crawl", { fallback, now: () => after(MINUTE) })).kind).toBe("skipped");
    expect(store.runs).toHaveLength(1);
  });

  it("running が 1時間59分なら有効（スキップ）、2時間1分なら無効（失効させて開始）", async () => {
    const { fallback } = makeFallback();

    const valid = new InMemoryRunStore();
    await startRun(valid, "crawl", { fallback, now: () => t0 });
    expect((await startRun(valid, "crawl", { fallback, now: () => after(119 * MINUTE) })).kind).toBe("skipped");

    const stale = new InMemoryRunStore();
    await startRun(stale, "crawl", { fallback, now: () => t0 });
    const result = await startRun(stale, "crawl", { fallback, now: () => after(121 * MINUTE) });
    expect(result.kind).toBe("started");
    expect(stale.runs[0]).toMatchObject({ status: "failed", errorSummary: STALE_RUN_SUMMARY });
    expect(stale.runs[1].status).toBe("running");
  });

  it("DB に記録できないときはローカルログに残し、unavailable を返す（エラー本文は出さない）", async () => {
    const store = new InMemoryRunStore();
    store.failAll = true;
    const { fallback, events } = makeFallback();
    const result = await startRun(store, "crawl", { fallback, now: () => t0 });
    expect(result.kind).toBe("unavailable");
    expect(events).toHaveLength(1);
    expect(JSON.stringify(events[0])).not.toContain("db unavailable");
  });

  it("終了の記録に失敗したらローカルログに残す", async () => {
    const store = new InMemoryRunStore();
    const { fallback, events } = makeFallback();
    const started = await startRun(store, "crawl", { fallback, now: () => t0 });
    if (started.kind !== "started") throw new Error("not started");
    store.failAll = true;
    const ok = await finishRun(store, started.runId, buildOutcome({ fetched: 1, saved: 1, failed: 0, truncated: false }), {
      fallback,
    });
    expect(ok).toBe(false);
    expect(events[0]).toMatchObject({ run_id: started.runId, status: "success" });
  });

  it("finishRun は自分の id かつ running の行だけ更新する（失効済み・別 id は変わらない）", async () => {
    const store = new InMemoryRunStore();
    const { fallback, events } = makeFallback();

    // 1つ目が異常終了扱いで失効 → 2つ目が走り始める
    const first = await startRun(store, "crawl", { fallback, now: () => t0 });
    const second = await startRun(store, "crawl", { fallback, now: () => after(121 * MINUTE) });
    if (first.kind !== "started" || second.kind !== "started") throw new Error("not started");

    // 遅れて1つ目の終了処理が来ても、失効済みの行は上書きされず、2つ目の running も壊れない
    const ok = await finishRun(store, first.runId, buildOutcome({ fetched: 1, saved: 1, failed: 0, truncated: false }), {
      fallback,
      now: () => after(125 * MINUTE),
    });
    expect(ok).toBe(false);
    expect(store.runs[0]).toMatchObject({ status: "failed", errorSummary: STALE_RUN_SUMMARY });
    expect(store.runs[1].status).toBe("running");
    // 更新が0件なのでローカルログに残る
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ run_id: first.runId });
  });
});

describe("上限で打ち切り → 記録される", () => {
  async function runWithCap(items: string[], handlerMinutes: number, savesFirst: boolean) {
    const store = new InMemoryRunStore();
    const { fallback } = makeFallback();
    let current = t0.getTime();
    const now = () => new Date(current);
    const started = await startRun(store, "crawl", { fallback, now });
    if (started.kind !== "started") throw new Error("not started");

    const result = await processItems(
      items,
      async () => {
        current += handlerMinutes * MINUTE;
        if (!savesFirst) throw new Error("fail");
      },
      { startedAt: t0.getTime(), now: () => current, maxRunMs: 10 * MINUTE }
    );
    await finishRun(
      store,
      started.runId,
      buildOutcome({ fetched: items.length, saved: result.saved, failed: result.failed, truncated: result.truncated }),
      { fallback, now }
    );
    return { store, result };
  }

  it("保存済み分があれば success で、error_summary に「時間上限で打ち切り」が残る（未処理は失敗に数えない）", async () => {
    const { store, result } = await runWithCap(["a", "b", "c", "d", "e"], 4, true);
    expect(result.truncated).toBe(true);
    expect(store.runs[0]).toMatchObject({
      status: "success",
      successCount: result.saved,
      failureCount: 0,
      errorSummary: "時間上限で打ち切り",
    });
    expect(result.unprocessed).toBeGreaterThan(0);
  });

  it("保存が0件で打ち切りなら failed", async () => {
    const { store, result } = await runWithCap(["a", "b", "c", "d", "e"], 4, false);
    expect(result.truncated).toBe(true);
    expect(store.runs[0]).toMatchObject({ status: "failed", successCount: 0 });
    expect(store.runs[0].errorSummary).toContain("時間上限で打ち切り");
  });
});

describe("createFileFallbackLogger", () => {
  it("JSON 1行を追記する（書き込みに失敗しても例外を投げない）", () => {
    const lines: string[] = [];
    const logger = createFileFallbackLogger("C:\\state", {
      mkdirSync: () => {},
      appendFileSync: (_f, data) => void lines.push(data),
      now: () => t0,
    });
    logger.write({ message: "x", run_id: "r1" });
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({ message: "x", run_id: "r1", logger_name: "crawl.runs" });

    const broken = createFileFallbackLogger("C:\\state", {
      mkdirSync: () => {
        throw new Error("disk");
      },
    });
    expect(() => broken.write({ message: "y" })).not.toThrow();
  });
});
