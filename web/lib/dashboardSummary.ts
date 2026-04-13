export type DashboardStatusInput = {
  hasDb: boolean;
  dbError: string | null;
  totalEvents: number;
};

export const buildDashboardStatus = (
  input: DashboardStatusInput
): { tone: "missing" | "error" | "ok"; message: string } => {
  if (!input.hasDb) {
    return {
      tone: "missing",
      message:
        "DATABASE_URL nao configurada. Defina web/.env.local, execute db:push e valide /api/health.",
    };
  }
  if (input.dbError) {
    return {
      tone: "error",
      message: `Falha ao consultar pipeline_events: ${input.dbError}`,
    };
  }
  return {
    tone: "ok",
    message: `Registros em pipeline_events: ${input.totalEvents}`,
  };
};
