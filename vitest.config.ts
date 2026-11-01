import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// *.rls.test.ts は実DB（テスト用Supabase）に接続するため、通常の npm test からは除外する。
// 実行は npm run test:rls（vitest.rls.config.ts）。
const excludeRls = ["**/node_modules/**", "**/*.rls.test.ts"];

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    projects: [
      {
        // lib / src は DOM を使わないので node 環境で動かす。
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["lib/**/*.test.ts", "src/**/*.test.ts"],
          exclude: excludeRls,
        },
      },
      {
        // コンポーネント・フックは jsdom + React Testing Library。
        extends: true,
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["components/**/*.test.{ts,tsx}", "hooks/**/*.test.{ts,tsx}"],
          exclude: excludeRls,
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": __dirname,
    },
  },
});
