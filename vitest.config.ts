import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: { provider: "v8" },
    // Integration files bootstrap cluster-wide roles on one disposable server; run files one at a time.
    fileParallelism: false,
  },
});
