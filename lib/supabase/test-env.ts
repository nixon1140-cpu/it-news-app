// RLSテスト用の環境変数の読み込みと安全ガード。
// キーの値はログ・エラー文に出さない（「有るか無いか」だけを扱う）。
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { parse } from "dotenv";

export interface RlsEnv {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

export type RlsEnvResult =
  | { status: "skip"; reason: string }
  | { status: "ready"; env: RlsEnv };

type EnvRecord = Record<string, string | undefined>;

// 本番DBを誤って操作しないための即停止エラー。スキップではなく失敗として扱う。
export class ProductionGuardError extends Error {}

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, "").toLowerCase();
}

// テスト用の値が揃っていなければスキップ。揃っていても本番URLと同じ／本番URLを確認できないときは停止。
export function evaluateRlsEnv(testEnv: EnvRecord, prodEnv: EnvRecord): RlsEnvResult {
  const url = testEnv.TEST_SUPABASE_URL?.trim() ?? "";
  const anonKey = testEnv.TEST_SUPABASE_ANON_KEY?.trim() ?? "";
  const serviceRoleKey = testEnv.TEST_SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

  const missing = [
    ["TEST_SUPABASE_URL", url],
    ["TEST_SUPABASE_ANON_KEY", anonKey],
    ["TEST_SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) {
    return { status: "skip", reason: `.env.test が無い、または未設定/空: ${missing.join(", ")}` };
  }

  const prodUrls = [prodEnv.NEXT_PUBLIC_SUPABASE_URL, prodEnv.SUPABASE_URL]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean)
    .map(normalizeUrl);
  if (prodUrls.length === 0) {
    throw new ProductionGuardError(
      "本番URL（.env.local の NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL）を確認できないため、RLSテストを中止しました。"
    );
  }
  if (prodUrls.includes(normalizeUrl(url))) {
    throw new ProductionGuardError(
      "TEST_SUPABASE_URL が本番URL（.env.local）と同じです。本番DBの誤操作を防ぐため、RLSテストを中止しました。"
    );
  }

  return { status: "ready", env: { url, anonKey, serviceRoleKey } };
}

function readEnvFile(fileName: string): EnvRecord {
  const filePath = path.resolve(process.cwd(), fileName);
  return existsSync(filePath) ? parse(readFileSync(filePath)) : {};
}

// .env.test と .env.local を読み、判定結果を返す（process.env は書き換えない）。
export function loadRlsEnv(): RlsEnvResult {
  return evaluateRlsEnv(readEnvFile(".env.test"), readEnvFile(".env.local"));
}
