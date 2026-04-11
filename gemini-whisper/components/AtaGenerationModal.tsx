import React, { useEffect, useState } from "react";
import { FileText, Loader2, Mail, Send, Users, X } from "lucide-react";
import { AtaPipelineDefaults, QueueItem } from "../types";

interface AtaGenerationModalProps {
  isOpen: boolean;
  item: QueueItem | null;
  defaults: AtaPipelineDefaults;
  isSubmitting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSubmit: (payload: {
    projeto: string;
    sprint: string;
    participantes: string;
    destinatarios: string;
    meetingTitle: string;
    meetingDate: string;
  }) => void;
}

const buildDefaultTitle = (fileName: string): string => {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim() || "Nova reunião";
};

const todayIso = (): string => new Date().toISOString().slice(0, 10);

const AtaGenerationModal: React.FC<AtaGenerationModalProps> = ({
  isOpen,
  item,
  defaults,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
}) => {
  const [projeto, setProjeto] = useState(defaults.projeto);
  const [sprint, setSprint] = useState(defaults.sprint);
  const [participantes, setParticipantes] = useState(defaults.participantes);
  const [destinatarios, setDestinatarios] = useState(defaults.destinatarios);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState(todayIso());

  useEffect(() => {
    if (!isOpen || !item) return;

    const participantsFromProfiles = item.result?.speakerProfiles?.map((profile) => profile.displayName).join(", ") || defaults.participantes;
    setProjeto(defaults.projeto);
    setSprint(defaults.sprint);
    setParticipantes(participantsFromProfiles);
    setDestinatarios(defaults.destinatarios);
    setMeetingTitle(buildDefaultTitle(item.file.name));
    setMeetingDate(todayIso());
  }, [defaults, isOpen, item]);

  if (!isOpen || !item) return null;

  const handleSubmit = () => {
    onSubmit({
      projeto: projeto.trim() || "GERAL",
      sprint: sprint.trim(),
      participantes,
      destinatarios,
      meetingTitle: meetingTitle.trim() || buildDefaultTitle(item.file.name),
      meetingDate,
    });
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              Gerar ATA
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Confirme os metadados da reunião antes de executar o pipeline.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 grid gap-4">
          <div className="grid md:grid-cols-2 gap-4">
            <label className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase">Título</span>
              <input
                type="text"
                value={meetingTitle}
                onChange={(event) => setMeetingTitle(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase">Data</span>
              <input
                type="date"
                value={meetingDate}
                onChange={(event) => setMeetingDate(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </label>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <label className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase">Projeto</span>
              <input
                type="text"
                value={projeto}
                onChange={(event) => setProjeto(event.target.value)}
                placeholder="GERAL"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase">Sprint</span>
              <input
                type="text"
                value={sprint}
                onChange={(event) => setSprint(event.target.value)}
                placeholder="Sprint-2026-W15"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </label>
          </div>

          <label className="space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase flex items-center gap-2">
              <Users className="w-4 h-4" />
              Participantes
            </span>
            <textarea
              value={participantes}
              onChange={(event) => setParticipantes(event.target.value)}
              rows={3}
              placeholder="Nome 1, Nome 2, Nome 3"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Destinatários de e-mail
            </span>
            <textarea
              value={destinatarios}
              onChange={(event) => setDestinatarios(event.target.value)}
              rows={2}
              placeholder="email1@empresa.com, email2@empresa.com"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </label>

          {errorMessage && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            A transcrição atual será usada como entrada do pipeline multiagente.
          </p>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {isSubmitting ? "Executando pipeline..." : "Gerar ATA"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AtaGenerationModal;
