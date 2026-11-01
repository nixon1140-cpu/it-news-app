// crawl_runs の Supabase 版 RunStore。service_role のクライアントで使う（anon は権限なし）。
import type { SupabaseClient } from "@supabase/supabase-js";

import { STALE_RUN_SUMMARY, type JobType, type RunFinish, type RunStore } from "./types";

const TABLE = "crawl_runs";
// Postgres の一意制約違反。同じ種別の running が既にある（= 二重実行）ことを表す。
const UNIQUE_VIOLATION = "23505";

// エラー本文（message）は URL 等を含み得るため保持しない。コードだけ持つ。
export class RunStoreError extends Error {
  constructor(public readonly code: string | undefined) {
    super(`crawl_runs operation failed (code: ${code ?? "unknown"})`);
  }
}

export function createSupabaseRunStore(client: SupabaseClient): RunStore {
  return {
    async expireStale(jobType: JobType, cutoff: Date): Promise<number> {
      const { data, error } = await client
        .from(TABLE)
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error_summary: STALE_RUN_SUMMARY,
        })
        .eq("job_type", jobType)
        .eq("status", "running")
        .lt("started_at", cutoff.toISOString())
        .select("id");
      if (error) throw new RunStoreError(error.code);
      return data?.length ?? 0;
    },

    async tryInsertRunning(jobType: JobType, startedAt: Date) {
      const { data, error } = await client
        .from(TABLE)
        .insert({ job_type: jobType, status: "running", started_at: startedAt.toISOString() })
        .select("id")
        .single();
      if (error) {
        if (error.code === UNIQUE_VIOLATION) return null;
        throw new RunStoreError(error.code);
      }
      return { id: data.id as string };
    },

    async finish(id: string, update: RunFinish): Promise<boolean> {
      // 更新条件は「自分の id かつ status='running'」。失効済み・別の実行の行は変えない。
      const { data, error } = await client
        .from(TABLE)
        .update({
          status: update.status,
          finished_at: update.finishedAt.toISOString(),
          success_count: update.successCount,
          failure_count: update.failureCount,
          error_summary: update.errorSummary,
        })
        .eq("id", id)
        .eq("status", "running")
        .select("id");
      if (error) throw new RunStoreError(error.code);
      return (data?.length ?? 0) > 0;
    },

    async latestSuccess(jobType: JobType) {
      const { data, error } = await client
        .from(TABLE)
        .select("finished_at")
        .eq("job_type", jobType)
        .eq("status", "success")
        .not("finished_at", "is", null)
        .order("finished_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new RunStoreError(error.code);
      return data?.finished_at ? { finishedAt: new Date(data.finished_at as string) } : null;
    },

    async currentRunning(jobType: JobType) {
      const { data, error } = await client
        .from(TABLE)
        .select("started_at")
        .eq("job_type", jobType)
        .eq("status", "running")
        .limit(1)
        .maybeSingle();
      if (error) throw new RunStoreError(error.code);
      return data?.started_at ? { startedAt: new Date(data.started_at as string) } : null;
    },
  };
}
