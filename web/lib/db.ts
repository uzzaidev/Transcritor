import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";
import { getEnv } from "@/lib/localEnv";

export function getDb() {
  const url = getEnv("DATABASE_URL");
  if (!url) {
    return null;
  }
  const sql = neon(url);
  return drizzle(sql, { schema });
}
