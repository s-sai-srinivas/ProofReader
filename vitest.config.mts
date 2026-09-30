import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/app/api/**"],
      exclude: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    },
    env: {
      JWT_SECRET: "test-jwt-secret-that-is-long-enough-for-testing-12345",
      GEMINI_API_KEY: "test-key-not-used-in-ci",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
