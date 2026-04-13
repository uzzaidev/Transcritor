import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const timestamp = new Date().toISOString();

  if (!db) {
    return NextResponse.json(
      {
        status: "degraded",
        timestamp,
        dbConfigured: false,
        dbReachable: false,
      },
      { status: 503 }
    );
  }

  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({
      status: "ok",
      timestamp,
      dbConfigured: true,
      dbReachable: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "database_unreachable";
    return NextResponse.json(
      {
        status: "degraded",
        timestamp,
        dbConfigured: true,
        dbReachable: false,
        error: message,
      },
      { status: 503 }
    );
  }
}
