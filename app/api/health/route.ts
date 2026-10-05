import { NextResponse } from "next/server";

import { DEFAULT_OLLAMA_MODEL } from "@/lib/ollama/client";
import { checkOllama } from "@/lib/ollama/health";

export const dynamic = "force-dynamic";

// アプリ自身は常に応答できるため200を返し、Ollamaの状態は本文で伝える。
export async function GET() {
  const ollama = await checkOllama(DEFAULT_OLLAMA_MODEL);
  return NextResponse.json({
    app: "ok",
    ollama,
    model: DEFAULT_OLLAMA_MODEL,
    checkedAt: new Date().toISOString(),
  });
}
