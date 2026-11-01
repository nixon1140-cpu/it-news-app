import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { FallbackLogger } from "./types";

// ローカルの状態フォルダ。start-app.bat と同じ %LOCALAPPDATA%\it-news-app。
// 環境変数が無ければホームフォルダ配下を使う。
export function getStateDir(env: NodeJS.ProcessEnv = process.env): string {
  const base = env.LOCALAPPDATA?.trim();
  return base ? path.join(base, "it-news-app") : path.join(os.homedir(), ".it-news-app");
}

export interface FileFallbackDeps {
  mkdirSync?: (dir: string) => void;
  appendFileSync?: (file: string, data: string) => void;
  now?: () => Date;
}

// DB に記録できないとき、JSON 1行を crawl-fallback.log に追記する。
// 書き込みに失敗しても例外は投げない（本処理を止めない）。キー・本文は渡さないこと。
export function createFileFallbackLogger(
  dir: string = getStateDir(),
  deps: FileFallbackDeps = {}
): FallbackLogger {
  const mkdirSync = deps.mkdirSync ?? ((d: string) => void fs.mkdirSync(d, { recursive: true }));
  const appendFileSync = deps.appendFileSync ?? ((f: string, d: string) => fs.appendFileSync(f, d, "utf8"));
  const now = deps.now ?? (() => new Date());
  const file = path.join(dir, "crawl-fallback.log");

  return {
    write(event) {
      try {
        mkdirSync(dir);
        const line = JSON.stringify({
          timestamp: now().toISOString(),
          level: "WARNING",
          logger_name: "crawl.runs",
          ...event,
        });
        appendFileSync(file, `${line}\n`);
      } catch {
        // ローカルログにも書けない場合は何もしない。
      }
    },
  };
}
