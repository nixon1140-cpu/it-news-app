import { describe, expect, it } from "vitest";

import { OllamaConnectionError, OllamaHttpError } from "../ollama/client";
import { OllamaModelNotFoundError } from "../ollama/health";
import { sanitizeSummary, summarizeError } from "./sanitize";

describe("sanitizeSummary", () => {
  it("20文字以上の英数字の並びを **** にする", () => {
    expect(sanitizeSummary("key=abcdefghij0123456789ABCDE end")).toBe("key=**** end");
  });

  it("eyJ で始まる値（JWT）を **** にする", () => {
    expect(sanitizeSummary("token eyJhbGciOi.payload.sig here")).toBe("token **** here");
  });

  it("URL を **** にする", () => {
    expect(sanitizeSummary("failed https://example.com/path?q=1 now")).toBe("failed **** now");
  });

  it("200文字に切り詰める", () => {
    expect(sanitizeSummary("あ".repeat(500))).toHaveLength(200);
  });
});

describe("summarizeError", () => {
  it("既知の例外は種類名と固定文だけ（error.message は使わない）", () => {
    const error = new OllamaConnectionError("Ollama API に接続できません: https://secret.example/key=abcdefghij0123456789");
    const summary = summarizeError(error);
    expect(summary).toBe("OllamaConnectionError: Ollamaに接続できませんでした");
    expect(summary).not.toContain("secret");
  });

  it("20文字を超える既知のクラス名も伏せ字にならない", () => {
    expect(summarizeError(new OllamaModelNotFoundError("m"))).toContain("OllamaModelNotFoundError");
    expect(summarizeError(new OllamaHttpError(500, "x"))).toContain("OllamaHttpError");
  });

  it("未知の例外は種類名のみ", () => {
    class CustomFailure extends Error {}
    expect(summarizeError(new CustomFailure("eyJsecretvalue.with.token"))).toBe("CustomFailure");
  });

  it("Error 以外（文字列など）は汎用名にし、中身を出さない", () => {
    expect(summarizeError("eyJabcdefghijklmnopqrstuvwxyz")).not.toContain("eyJ");
  });
});
