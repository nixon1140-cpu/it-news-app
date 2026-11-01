// テスト用の RunStore（メモリ上）。本番の部分一意索引と同じ「同種別の running は1つ」を再現する。
import { STALE_RUN_SUMMARY, type JobType, type RunFinish, type RunStatus, type RunStore } from "../types";

export interface MemoryRun {
  id: string;
  jobType: JobType;
  status: RunStatus;
  startedAt: Date;
  finishedAt: Date | null;
  successCount: number;
  failureCount: number;
  errorSummary: string | null;
}

export class InMemoryRunStore implements RunStore {
  runs: MemoryRun[] = [];
  private seq = 0;
  // テスト用: true にすると全操作が例外になる（DB 不可の再現）
  failAll = false;

  private guard() {
    if (this.failAll) throw new Error("db unavailable");
  }

  async expireStale(jobType: JobType, cutoff: Date): Promise<number> {
    this.guard();
    let count = 0;
    for (const run of this.runs) {
      if (run.jobType === jobType && run.status === "running" && run.startedAt < cutoff) {
        run.status = "failed";
        run.errorSummary = STALE_RUN_SUMMARY;
        count++;
      }
    }
    return count;
  }

  async tryInsertRunning(jobType: JobType, startedAt: Date): Promise<{ id: string } | null> {
    this.guard();
    if (this.runs.some((r) => r.jobType === jobType && r.status === "running")) return null;
    const id = `run-${++this.seq}`;
    this.runs.push({
      id,
      jobType,
      status: "running",
      startedAt,
      finishedAt: null,
      successCount: 0,
      failureCount: 0,
      errorSummary: null,
    });
    return { id };
  }

  async finish(id: string, update: RunFinish): Promise<boolean> {
    this.guard();
    const run = this.runs.find((r) => r.id === id && r.status === "running");
    if (!run) return false;
    run.status = update.status;
    run.finishedAt = update.finishedAt;
    run.successCount = update.successCount;
    run.failureCount = update.failureCount;
    run.errorSummary = update.errorSummary;
    return true;
  }

  async latestSuccess(jobType: JobType) {
    this.guard();
    const done = this.runs
      .filter((r) => r.jobType === jobType && r.status === "success" && r.finishedAt)
      .sort((a, b) => b.finishedAt!.getTime() - a.finishedAt!.getTime());
    return done[0]?.finishedAt ? { finishedAt: done[0].finishedAt } : null;
  }

  async currentRunning(jobType: JobType) {
    this.guard();
    const run = this.runs.find((r) => r.jobType === jobType && r.status === "running");
    return run ? { startedAt: run.startedAt } : null;
  }
}
