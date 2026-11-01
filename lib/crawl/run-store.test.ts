import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { createSupabaseRunStore, RunStoreError } from "./run-store";

// Supabase のクエリビルダーの代わり。どのメソッドも自分自身を返し、await すると result を返す。
function stubClient(result: { data?: unknown; error?: { code?: string } | null }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = {};
  const chain = new Proxy(builder, {
    get(_target, prop: string) {
      if (prop === "then") {
        return (resolve: (value: unknown) => void) => resolve({ data: result.data ?? null, error: result.error ?? null });
      }
      return (...args: unknown[]) => {
        calls.push({ method: prop, args });
        return chain;
      };
    },
  });
  return { client: chain as unknown as SupabaseClient, calls };
}

describe("createSupabaseRunStore（クエリの形と戻り値の確認。実DBは test:rls で確認）", () => {
  it("tryInsertRunning: 一意制約違反(23505)なら null（二重実行）", async () => {
    const { client } = stubClient({ error: { code: "23505" } });
    expect(await createSupabaseRunStore(client).tryInsertRunning("crawl", new Date())).toBeNull();
  });

  it("tryInsertRunning: それ以外のエラーは例外（コードのみ保持し、本文は持たない）", async () => {
    const { client } = stubClient({ error: { code: "42P01" } });
    await expect(createSupabaseRunStore(client).tryInsertRunning("crawl", new Date())).rejects.toBeInstanceOf(
      RunStoreError
    );
  });

  it("tryInsertRunning: 成功すると id を返す", async () => {
    const { client } = stubClient({ data: { id: "abc" } });
    expect(await createSupabaseRunStore(client).tryInsertRunning("crawl", new Date())).toEqual({ id: "abc" });
  });

  it("finish: 更新条件は id と status='running'。1件更新で true、0件で false", async () => {
    const hit = stubClient({ data: [{ id: "r1" }] });
    const update = { status: "success" as const, finishedAt: new Date(), successCount: 1, failureCount: 0, errorSummary: null };
    expect(await createSupabaseRunStore(hit.client).finish("r1", update)).toBe(true);
    expect(hit.calls).toContainEqual({ method: "eq", args: ["id", "r1"] });
    expect(hit.calls).toContainEqual({ method: "eq", args: ["status", "running"] });

    const miss = stubClient({ data: [] });
    expect(await createSupabaseRunStore(miss.client).finish("r1", update)).toBe(false);
  });

  it("expireStale: running かつ cutoff より前の行だけを failed にし、件数を返す", async () => {
    const { client, calls } = stubClient({ data: [{ id: "a" }, { id: "b" }] });
    const cutoff = new Date("2026-11-02T00:00:00Z");
    expect(await createSupabaseRunStore(client).expireStale("crawl", cutoff)).toBe(2);
    expect(calls).toContainEqual({ method: "eq", args: ["status", "running"] });
    expect(calls).toContainEqual({ method: "lt", args: ["started_at", cutoff.toISOString()] });
  });

  it("latestSuccess / currentRunning: 無ければ null、あれば日時を返す", async () => {
    const none = stubClient({ data: null });
    expect(await createSupabaseRunStore(none.client).latestSuccess("crawl")).toBeNull();
    expect(await createSupabaseRunStore(none.client).currentRunning("crawl")).toBeNull();

    const some = stubClient({ data: { finished_at: "2026-11-02T01:00:00Z", started_at: "2026-11-02T00:30:00Z" } });
    expect((await createSupabaseRunStore(some.client).latestSuccess("crawl"))?.finishedAt.toISOString()).toBe(
      "2026-11-02T01:00:00.000Z"
    );
    expect((await createSupabaseRunStore(some.client).currentRunning("crawl"))?.startedAt.toISOString()).toBe(
      "2026-11-02T00:30:00.000Z"
    );
  });
});
