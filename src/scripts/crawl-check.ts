// 収集を実行すべきかを判定する（start-app.bat から呼ぶ）。
// 実行: npm run crawl:check
// 終了コード: 0=実行する / 10=スキップ（直近12時間以内に成功した収集がある、または実行中） / 1=確認に失敗
// 標準出力には判定の理由だけを1行出す（キーや URL は出さない）。
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

import { createFileFallbackLogger } from "../../lib/crawl/fallback-log";
import { createSupabaseRunStore } from "../../lib/crawl/run-store";
import { summarizeError } from "../../lib/crawl/sanitize";
import { decideRun } from "../../lib/crawl/should-run";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const EXIT_RUN = 0;
const EXIT_SKIP = 10;
const EXIT_ERROR = 1;

async function check(): Promise<number> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    // start-app.bat のログ（コードページ依存）で文字化けしないよう、この行は ASCII にしている。
    console.log("check-error: missing SUPABASE env");
    return EXIT_ERROR;
  }

  const store = createSupabaseRunStore(createClient(url, key, { auth: { persistSession: false } }));
  const [latestSuccess, running] = await Promise.all([store.latestSuccess("crawl"), store.currentRunning("crawl")]);
  const decision = decideRun({
    now: new Date(),
    latestSuccessFinishedAt: latestSuccess?.finishedAt ?? null,
    runningStartedAt: running?.startedAt ?? null,
  });

  const detail = latestSuccess ? `last_success=${latestSuccess.finishedAt.toISOString()}` : "last_success=none";
  console.log(`${decision.run ? "run" : "skip"}: ${decision.reason} (${detail})`);
  return decision.run ? EXIT_RUN : EXIT_SKIP;
}

check()
  .then((code) => process.exit(code))
  .catch((error) => {
    // 確認自体の失敗（DB不可・crawl_runs 未作成など）。start-app.bat は安全側でスキップする。
    createFileFallbackLogger().write({
      message: "収集の実行要否を確認できませんでした",
      error_type: summarizeError(error),
    });
    console.log(`check-error: ${summarizeError(error)}`);
    process.exit(EXIT_ERROR);
  });
