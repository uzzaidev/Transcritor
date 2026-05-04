import Link from "next/link";
import { count, desc } from "drizzle-orm";
import { pipelineEvents } from "@/db/schema";
import { getDb } from "@/lib/db";
import { buildDashboardStatus } from "@/lib/dashboardSummary";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    page?: string;
    limit?: string;
  }>;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const parsePositiveInt = (raw: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(raw || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export default async function Home({ searchParams }: PageProps) {
  const resolvedSearchParams = (await searchParams) || {};
  const db = getDb();
  const page = parsePositiveInt(resolvedSearchParams.page, 1);
  const limit = clamp(parsePositiveInt(resolvedSearchParams.limit, 20), 5, 100);
  const offset = (page - 1) * limit;

  let total = 0;
  let dbError: string | null = null;
  let events: Array<{
    id: string;
    createdAt: Date;
    eventType: string;
    success: boolean | null;
    payload: Record<string, unknown> | null;
  }> = [];

  if (db) {
    try {
      const [row] = await db.select({ c: count() }).from(pipelineEvents);
      total = row?.c ?? 0;
      events = await db
        .select({
          id: pipelineEvents.id,
          createdAt: pipelineEvents.createdAt,
          eventType: pipelineEvents.eventType,
          success: pipelineEvents.success,
          payload: pipelineEvents.payload,
        })
        .from(pipelineEvents)
        .orderBy(desc(pipelineEvents.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      dbError = error instanceof Error ? error.message : "Erro ao consultar Neon";
    }
  }

  const totalPages = total > 0 ? Math.ceil(total / limit) : 1;
  const status = buildDashboardStatus({
    hasDb: Boolean(db),
    dbError,
    totalEvents: total,
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-16">
      <header className="space-y-2 border-b border-border pb-8">
        <p className="text-sm font-medium uppercase tracking-wide text-foreground-muted">
          Transcritor / agente de atas
        </p>
        <h1 className="text-3xl font-semibold text-foreground">
          Observabilidade do pipeline
        </h1>
        <p className="max-w-3xl text-foreground-muted">
          Dashboard protegido por autenticacao basica. Eventos ordenados por{" "}
          <code className="rounded bg-background-elevated px-1.5 py-0.5 font-mono text-sm text-accent">
            created_at desc
          </code>{" "}
          com paginacao/limite.
        </p>
      </header>

      <section className="rounded-card border border-border bg-background-elevated p-6">
        <h2 className="text-lg font-medium text-foreground">Status</h2>
        <p
          className={`mt-3 ${
            status.tone === "error" ? "text-danger" : "text-foreground-muted"
          }`}
        >
          {status.message}
        </p>
        <p className="mt-2 text-xs text-foreground-muted">
          Healthcheck:{" "}
          <code className="rounded bg-background px-1.5 py-0.5 font-mono text-accent">
            /api/health
          </code>
        </p>
      </section>

      <section className="rounded-card border border-border bg-background-elevated p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-foreground">Ultimos eventos</h2>
          <div className="text-sm text-foreground-muted">
            Total: <span className="font-semibold text-success">{total}</span>
            {" - "}
            Pagina {page}/{totalPages}
            {" - "}
            Limite {limit}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-background">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-foreground-muted">
                  Timestamp
                </th>
                <th className="px-3 py-2 text-left font-medium text-foreground-muted">
                  Tipo
                </th>
                <th className="px-3 py-2 text-left font-medium text-foreground-muted">
                  Success
                </th>
                <th className="px-3 py-2 text-left font-medium text-foreground-muted">
                  ID
                </th>
                <th className="px-3 py-2 text-left font-medium text-foreground-muted">
                  Payload
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="px-3 py-2 text-foreground-muted">
                    {new Date(event.createdAt).toISOString()}
                  </td>
                  <td className="px-3 py-2 text-foreground">{event.eventType}</td>
                  <td className="px-3 py-2">
                    {event.success === true && (
                      <span className="rounded bg-success/20 px-2 py-0.5 text-success">
                        true
                      </span>
                    )}
                    {event.success === false && (
                      <span className="rounded bg-danger/20 px-2 py-0.5 text-danger">
                        false
                      </span>
                    )}
                    {event.success === null && (
                      <span className="rounded bg-background px-2 py-0.5 text-foreground-muted">
                        null
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-foreground-muted">
                    {event.id}
                  </td>
                  <td className="max-w-[380px] truncate px-3 py-2 font-mono text-xs text-foreground-muted">
                    {event.payload ? JSON.stringify(event.payload) : "{}"}
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td
                    className="px-3 py-4 text-center text-foreground-muted"
                    colSpan={5}
                  >
                    Sem eventos para exibir nesta pagina.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm">
          <Link
            className={`rounded border border-border px-3 py-1 ${
              page <= 1
                ? "pointer-events-none opacity-40"
                : "hover:bg-background"
            }`}
            href={`/?page=${Math.max(1, page - 1)}&limit=${limit}`}
          >
            Anterior
          </Link>
          <Link
            className={`rounded border border-border px-3 py-1 ${
              page >= totalPages
                ? "pointer-events-none opacity-40"
                : "hover:bg-background"
            }`}
            href={`/?page=${Math.min(totalPages, page + 1)}&limit=${limit}`}
          >
            Proxima
          </Link>
        </div>
      </section>
    </main>
  );
}
