type AtaSubmissionInput = {
  projeto: string;
  sprint: string;
  participantes: string;
  destinatarios: string;
  meetingTitle: string;
  meetingDate: string;
  fallbackTitle: string;
  todayIso: string;
};

export type AtaSubmissionPayload = {
  projeto: string;
  sprint: string;
  participantes: string;
  destinatarios: string;
  meetingTitle: string;
  meetingDate: string;
};

export const buildDefaultTitle = (fileName: string): string =>
  fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Nova reuniao";

export const normalizeCsvList = (value: string): string[] =>
  value
    .split(/[,;\n]/g)
    .map((part) => part.trim())
    .filter(Boolean);

export const prepareAtaSubmissionPayload = (
  input: AtaSubmissionInput
): { ok: true; payload: AtaSubmissionPayload } | { ok: false; error: string } => {
  const destinatarios = normalizeCsvList(input.destinatarios);
  if (destinatarios.length === 0) {
    return { ok: false, error: "Informe ao menos um destinatario de e-mail." };
  }

  return {
    ok: true,
    payload: {
      projeto: input.projeto.trim() || "GERAL",
      sprint: input.sprint.trim(),
      participantes: input.participantes.trim(),
      destinatarios: destinatarios.join(", "),
      meetingTitle: input.meetingTitle.trim() || input.fallbackTitle,
      meetingDate: input.meetingDate || input.todayIso,
    },
  };
};
