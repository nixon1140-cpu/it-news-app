// ローカルLLM（Ollama）への接続クライアント。
// Node.js環境でのIPv6（::1）解決エラーを避けるため、127.0.0.1を明示する。
const OLLAMA_ENDPOINT = "http://127.0.0.1:11434/api/generate";
const DEFAULT_OLLAMA_MODEL = "llama3.1:8b";
// 出力途中での切断（Unterminated string等のJSONパースエラー）を防ぐための
// 十分な最大出力トークン数。
const DEFAULT_NUM_PREDICT = 2048;

export interface GenerateJsonOptions {
  model?: string;
  system?: string;
  // "json" のシンプル指定、またはOllamaの構造化出力用JSON Schemaオブジェクトを渡せる。
  format?: string | Record<string, unknown>;
  numPredict?: number;
}

export async function generateJson(
  prompt: string,
  options: GenerateJsonOptions = {}
): Promise<string> {
  const res = await fetch(OLLAMA_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: options.model ?? DEFAULT_OLLAMA_MODEL,
      prompt,
      ...(options.system ? { system: options.system } : {}),
      format: options.format ?? "json",
      stream: false,
      options: {
        num_predict: options.numPredict ?? DEFAULT_NUM_PREDICT,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama API エラー: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data.response as string;
}

export function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    return fenced[1].trim();
  }

  // 思考過程の断片など、JSON本体の前後に余分なテキストが混入する場合に備えて、
  // 最初の "{" から最後の "}" までを本体として抜き出す。
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1).trim();
  }

  return text.trim();
}
