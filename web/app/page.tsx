import { count } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pipelineEvents } from "@/db/schema";

export default async function Home() {
  const db = getDb();
  let total = 0;
  let dbError: string | null = null;

  if (db) {
    try {
      const [row] = await db.select({ c: count() }).from(pipelineEvents);
      total = row?.c ?? 0;
    } catch (e) {
      dbError = e instanceof Error ? e.message : "Erro ao consultar Neon";
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="space-y-2 border-b border-border pb-8">
        <p className="text-sm font-medium uppercase tracking-wide text-foreground-muted">
          Transcritor / agente de atas
        </p>
        <h1 className="text-3xl font-semibold text-foreground">
          Painel base (Next.js + Tailwind + Neon)
        </h1>
        <p className="max-w-xl text-foreground-muted">
          Tokens de cor e tema vivem em{" "}
          <code className="rounded bg-background-elevated px-1.5 py-0.5 font-mono text-sm text-accent">
            web/theme/tokens.ts
          </code>{" "}
          e são aplicados via{" "}
          <code className="rounded bg-background-elevated px-1.5 py-0.5 font-mono text-sm text-accent">
            tailwind.config.ts
          </code>
          . Não há login nesta versão.
        </p>
      </header>

      <section className="rounded-card border border-border bg-background-elevated p-6">
        <h2 className="text-lg font-medium text-foreground">Base de dados</h2>
        {!db && (
          <p className="mt-3 text-foreground-muted">
            Defina{" "}
            <code className="font-mono text-accent">DATABASE_URL</code> em{" "}
            <code className="font-mono text-accent">web/.env.local</code> (connection
            string da Neon). Depois execute{" "}
            <code className="font-mono text-accent">npm run db:push</code> na pasta{" "}
            <code className="font-mono text-accent">web/</code>.
          </p>
        )}
        {db && dbError && (
          <p className="mt-3 text-danger">
            {dbError} — confirme se a tabela existe (<code className="font-mono">db:push</code>
            ).
          </p>
        )}
        {db && !dbError && (
          <p className="mt-3 text-foreground-muted">
            Registos em{" "}
            <code className="font-mono text-accent">pipeline_events</code>:{" "}
            <span className="font-semibold text-success">{total}</span>
          </p>
        )}
      </section>

      <section className="rounded-card border border-border bg-background-elevated p-6">
        <h2 className="text-lg font-medium text-foreground">Pipeline Python</h2>
        <p className="mt-3 text-foreground-muted">
          O processamento automático (IMAP → Gemini → SMTP) corre no pacote{" "}
          <code className="font-mono text-accent">ata_agent/</code>. Ver{" "}
          <code className="font-mono text-accent">ata_agent/README.md</code> e{" "}
          <code className="font-mono text-accent">PLANO_PIPELINE_MULTIAGENTE.md</code>.
        </p>
      </section>
    </main>
  );
}
