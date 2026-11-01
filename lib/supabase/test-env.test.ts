import { describe, expect, it } from "vitest";

import { evaluateRlsEnv, ProductionGuardError } from "./test-env";

// ダミー値のみ使用（実際のキー・URLは使わない）。
const full = {
  TEST_SUPABASE_URL: "https://test-project.example.co",
  TEST_SUPABASE_ANON_KEY: "dummy-anon",
  TEST_SUPABASE_SERVICE_ROLE_KEY: "dummy-service",
};
const prod = {
  NEXT_PUBLIC_SUPABASE_URL: "https://prod-project.example.co",
  SUPABASE_URL: "https://prod-project.example.co",
};

describe("evaluateRlsEnv", () => {
  it(".env.test が無い（全部空）ならスキップ", () => {
    expect(evaluateRlsEnv({}, prod).status).toBe("skip");
  });

  it("値が1つでも空ならスキップし、理由に空の変数名だけを出す", () => {
    const result = evaluateRlsEnv({ ...full, TEST_SUPABASE_SERVICE_ROLE_KEY: "  " }, prod);
    expect(result.status).toBe("skip");
    if (result.status === "skip") {
      expect(result.reason).toContain("TEST_SUPABASE_SERVICE_ROLE_KEY");
      expect(result.reason).not.toContain("dummy");
    }
  });

  it("本番URLと同じなら即停止する（末尾スラッシュ・大文字小文字の違いも同じ扱い）", () => {
    const same = { ...full, TEST_SUPABASE_URL: "HTTPS://Prod-Project.example.co/" };
    expect(() => evaluateRlsEnv(same, prod)).toThrow(ProductionGuardError);
  });

  it("本番URLを確認できないときも即停止する", () => {
    expect(() => evaluateRlsEnv(full, {})).toThrow(ProductionGuardError);
  });

  it("停止時のエラー文にURLやキーの値を含めない", () => {
    expect.assertions(3);
    try {
      evaluateRlsEnv({ ...full, TEST_SUPABASE_URL: prod.SUPABASE_URL }, prod);
    } catch (error) {
      const message = (error as Error).message;
      expect(error).toBeInstanceOf(ProductionGuardError);
      expect(message).not.toContain("prod-project");
      expect(message).not.toContain("dummy");
    }
  });

  it("本番と別URLで3値が揃っていれば ready", () => {
    expect(evaluateRlsEnv(full, prod).status).toBe("ready");
  });
});
