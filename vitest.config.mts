import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // `convex-test` runs the functions in this process, so the Node
    // environment keeps `process.env` (ADMIN_EMAILS) and fetch realistic.
    environment: "node",
    include: ["convex/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
