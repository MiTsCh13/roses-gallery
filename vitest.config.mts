import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    globalSetup: ["./src/test/db-global-setup.ts"],
    fileParallelism: false,
    include: ["src/**/*.test.{ts,tsx}", "worker/**/*.test.ts"],
  },
});
