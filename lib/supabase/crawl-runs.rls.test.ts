// crawl_runs テーブルの権限（GRANT）と RLS を、テスト専用の Supabase プロジェクトで確認する。
// - anon は読めない（「42501 エラー」または「0件」のどちらも合格。それ以外のエラーは不合格）
// - service_role は読み書きできる
// - 同じ種別の running は2つ作れない（23505）＝二重実行の防止
// 実行: npm run test:rls（.env.test が無い／空ならスキップ、本番URLと同じなら即停止）
import { randomBytes } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadRlsEnv } from "./test-env";

const envResult = loadRlsEnv();
if (envResult.status === "skip") {
  console.warn(`[rls] スキップ: ${envResult.reason}`);
}

// 実運用の crawl 行と混ざらないよう、テストは未使用の job_type（digest）と
// error_summary の接頭辞 test- で行を識別し、終了時にまとめて削除する。
const runId = randomBytes(4).toString("hex");
const marker = `test-${runId}`;

describe.skipIf(envResult.status !== "ready")("crawl_runs の権限と二重実行防止", () => {
  let anon: SupabaseClient;
  let service: SupabaseClient;

  async function cleanup() {
    await service.from("crawl_runs").delete().like("error_summary", "test-%");
  }

  async function fetchByMarker() {
    const { data, error } = await service.from("crawl_runs").select("*").eq("error_summary", marker);
    expect(error).toBeNull();
    return data ?? [];
  }

  beforeAll(async () => {
    if (envResult.status !== "ready") return;
    const { url, anonKey, serviceRoleKey } = envResult.env;
    anon = createClient(url, anonKey, { auth: { persistSession: false } });
    service = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
    await cleanup();
  });

  afterAll(async () => {
    if (service) await cleanup();
  });

  it("service_role は INSERT / UPDATE / 読み取りできる", async () => {
    const inserted = await service
      .from("crawl_runs")
      .insert({ job_type: "digest", status: "success", error_summary: marker, success_count: 3 })
      .select();
    expect(inserted.error).toBeNull();
    expect(inserted.data).toHaveLength(1);

    const updated = await service
      .from("crawl_runs")
      .update({ failure_count: 1 })
      .eq("error_summary", marker)
      .select();
    expect(updated.error).toBeNull();
    expect(updated.data?.[0]?.failure_count).toBe(1);

    expect(await fetchByMarker()).toHaveLength(1);
  });

  it("anon は crawl_runs を読めない（42501 エラーまたは0件）", async () => {
    // 読まれる側の行が実際に存在することを、先に service_role で確認する。
    expect((await fetchByMarker()).length).toBeGreaterThan(0);

    const { data, error } = await anon.from("crawl_runs").select("*").eq("error_summary", marker);
    if (error) {
      expect(error.code).toBe("42501");
    } else {
      expect(data ?? []).toEqual([]);
    }
  });

  it("anon は crawl_runs に書き込めず、行も変わらない", async () => {
    const before = await fetchByMarker();

    const inserted = await anon
      .from("crawl_runs")
      .insert({ job_type: "digest", status: "success", error_summary: `${marker}-anon` })
      .select();
    if (inserted.error) {
      expect(inserted.error.code).toBe("42501");
    } else {
      expect(inserted.data ?? []).toEqual([]);
    }

    const updated = await anon
      .from("crawl_runs")
      .update({ status: "failed" })
      .eq("error_summary", marker)
      .select();
    if (updated.error) {
      expect(updated.error.code).toBe("42501");
    } else {
      expect(updated.data ?? []).toEqual([]);
    }

    const { data: anonRows } = await service
      .from("crawl_runs")
      .select("*")
      .like("error_summary", `${marker}%`);
    expect(anonRows).toHaveLength(before.length);
    expect(await fetchByMarker()).toEqual(before);
  });

  it("同じ種別の running を2つ作ると、2つ目は一意制約（23505）で失敗する", async () => {
    const first = await service
      .from("crawl_runs")
      .insert({ job_type: "digest", status: "running", error_summary: `${marker}-run1` });
    expect(first.error).toBeNull();

    const second = await service
      .from("crawl_runs")
      .insert({ job_type: "digest", status: "running", error_summary: `${marker}-run2` });
    expect(second.error?.code).toBe("23505");

    // running が終われば、同じ種別でもう一度 running を作れる。
    const finished = await service
      .from("crawl_runs")
      .update({ status: "failed", finished_at: new Date().toISOString() })
      .eq("error_summary", `${marker}-run1`);
    expect(finished.error).toBeNull();

    const third = await service
      .from("crawl_runs")
      .insert({ job_type: "digest", status: "running", error_summary: `${marker}-run3` });
    expect(third.error).toBeNull();
  });
});
