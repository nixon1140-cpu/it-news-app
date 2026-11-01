import { defineConfig } from "vitest/config";

// RLSテスト専用。実際のテスト用Supabaseに接続するため、通常の npm test には含めない。
// 実行: npm run test:rls
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.rls.test.ts"],
    exclude: ["**/node_modules/**"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": __dirname,
    },
  },
});
