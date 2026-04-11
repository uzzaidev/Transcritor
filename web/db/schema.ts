import { boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Eventos do pipeline (atas / entregas) para observabilidade na Neon. */
export const pipelineEvents = pgTable("pipeline_events", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  eventType: text("event_type").notNull(),
  success: boolean("success"),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
});
