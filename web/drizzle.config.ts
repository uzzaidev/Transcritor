import { getEnv, loadLocalEnvFallbacks } from "./lib/localEnv";
import { defineConfig } from "drizzle-kit";

loadLocalEnvFallbacks();

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: getEnv("DATABASE_URL") ?? "",
  },
});
