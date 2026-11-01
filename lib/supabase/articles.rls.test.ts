// articles テーブルの RLS（行レベルセキュリティ）を、テスト専用の Supabase プロジェクトで確認する。
// - .env.test が無い／値が空ならスキップ
// - TEST_SUPABASE_URL が本番URLと同じなら、読み込み時に例外を出して即停止
// 実行: npm run test:rls
import { randomBytes } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadRlsEnv } from "./test-env";

// 例外（ProductionGuardError）はここで投げられ、テストファイルごと失敗する。
const envResult = loadRlsEnv();
if (envResult.status === "skip") {
  console.warn(`[rls] スキップ: ${envResult.reason}`);
}

const runId = randomBytes(4).toString("hex");
const urlOf = (name: string) => `test-${runId}-${name}`;

function makeArticle(url: string) {
  return {
    title: "RLS test article",
    url,
    summary: "summary",
    trend_diff: "diff",
    action_individual: "action individual",
    action_enterprise: "action enterprise",
    category: "General",
    priority_label: "Low",
    importance: 1,
  };
}

describe.skipIf(envResult.status !== "ready")("articles の RLS", () => {
  let anon: SupabaseClient;
  let service: SupabaseClient;
  const seedUrl = urlOf("seed");

  async function fetchByUrl(url: string) {
    const { data, error } = await service.from("articles").select("*").eq("url", url);
    expect(error).toBeNull();
    return data ?? [];
  }

  // 失敗時も残らないよう、前回の残骸も含めて test- 接頭辞の行を service_role で削除する。
  async function cleanup() {
    await service.from("articles").delete().like("url", "test-%");
  }

  beforeAll(async () => {
    if (envResult.status !== "ready") return;
    const { url, anonKey, serviceRoleKey } = envResult.env;
    anon = createClient(url, anonKey, { auth: { persistSession: false } });
    service = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

    await cleanup();
    const { error } = await service.from("articles").insert(makeArticle(seedUrl));
    expect(error).toBeNull();
  });

  afterAll(async () => {
    if (service) await cleanup();
  });

  it("anon は SELECT できる", async () => {
    const { data, error } = await anon.from("articles").select("url").eq("url", seedUrl);
    expect(error).toBeNull();
    expect(data).toEqual([{ url: seedUrl }]);
  });

  it("anon の INSERT は 42501 で拒否される", async () => {
    const url = urlOf("anon-insert");
    const { error } = await anon.from("articles").insert(makeArticle(url));
    expect(error?.code).toBe("42501");
    expect(await fetchByUrl(url)).toHaveLength(0);
  });

  it("anon の UPDATE はエラーにならず0件扱いで、行は変わらない", async () => {
    const { data, error } = await anon
      .from("articles")
      .update({ title: "hacked" })
      .eq("url", seedUrl)
      .select();
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const rows = await fetchByUrl(seedUrl);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("RLS test article");
  });

  it("anon の DELETE はエラーにならず0件扱いで、行は消えない", async () => {
    const { data, error } = await anon.from("articles").delete().eq("url", seedUrl).select();
    expect(error).toBeNull();
    expect(data).toEqual([]);

    expect(await fetchByUrl(seedUrl)).toHaveLength(1);
  });

  it("service_role は INSERT / UPDATE / DELETE できる", async () => {
    const url = urlOf("service-write");

    const inserted = await service.from("articles").insert(makeArticle(url));
    expect(inserted.error).toBeNull();

    const updated = await service.from("articles").update({ title: "updated" }).eq("url", url).select();
    expect(updated.error).toBeNull();
    expect(updated.data?.[0]?.title).toBe("updated");

    const deleted = await service.from("articles").delete().eq("url", url).select();
    expect(deleted.error).toBeNull();
    expect(deleted.data).toHaveLength(1);
    expect(await fetchByUrl(url)).toHaveLength(0);
  });

  it("url が重複する INSERT は一意制約（23505）で失敗する", async () => {
    const { error } = await service.from("articles").insert(makeArticle(seedUrl));
    expect(error?.code).toBe("23505");
  });
});
