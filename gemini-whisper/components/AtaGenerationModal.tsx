import React, { useEffect, useState } from "react";
import { FileText, Loader2, Mail, Send, Users, X } from "lucide-react";
import { AtaPipelineDefaults, AtaProjectProfile, QueueItem } from "../types";
import {
  buildDefaultTitle,
  prepareAtaSubmissionPayload,
} from "./ataGenerationValidation";

interface AtaGenerationModalProps {
  isOpen: boolean;
  item: QueueItem | null;
  defaults: AtaPipelineDefaults;
  projectProfiles: AtaProjectProfile[];
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

const todayIso = (): string => new Date().toISOString().slice(0, 10);
const normalizeProjectKey = (value: string): string => value.trim().toLowerCase();

const findProjectProfile = (
  projectProfiles: AtaProjectProfile[],
  projeto: string
): AtaProjectProfile | undefined =>
  projectProfiles.find(
    (profile) => normalizeProjectKey(profile.projeto) === normalizeProjectKey(projeto)
  );

const AtaGenerationModal: React.FC<AtaGenerationModalProps> = ({
  isOpen,
  item,
  defaults,
  projectProfiles,
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
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !item) return;

    const participantsFromProfiles =
      item.result?.speakerProfiles?.map((profile) => profile.displayName).join(", ") ||
      defaults.participantes;
    const matchedProfile = findProjectProfile(projectProfiles, defaults.projeto);
    setProjeto(matchedProfile?.projeto || defaults.projeto);
    setSprint(matchedProfile?.sprint || defaults.sprint);
    setParticipantes(
      participantsFromProfiles || matchedProfile?.participantes || defaults.participantes
    );
    setDestinatarios(matchedProfile?.destinatarios || defaults.destinatarios);
    setMeetingTitle(buildDefaultTitle(item.file.name));
    setMeetingDate(todayIso());
    setValidationError(null);
  }, [defaults, isOpen, item, projectProfiles]);

  const applyProjectProfile = (projectName: string) => {
    const profile = findProjectProfile(projectProfiles, projectName);
    if (!profile) return;
    setProjeto(profile.projeto);
    setSprint(profile.sprint || defaults.sprint);
    setParticipantes(profile.participantes || defaults.participantes);
    setDestinatarios(profile.destinatarios || defaults.destinatarios);
  };

  if (!isOpen || !item) return null;

  const handleSubmit = () => {
    const prepared = prepareAtaSubmissionPayload({
      projeto,
      sprint,
      participantes,
      destinatarios,
      meetingTitle,
      meetingDate,
      fallbackTitle: buildDefaultTitle(item.file.name),
      todayIso: todayIso(),
    });
    if (!prepared.ok) {
      setValidationError(prepared.error);
      return;
    }
    setValidationError(null);
    onSubmit(prepared.payload);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              <FileText className="h-5 w-5 text-blue-400" />
              Gerar ATA
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Confirme os metadados da reuniao antes de executar o pipeline.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-50"
            aria-label="Fechar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase text-slate-400">Titulo</span>
              <input
                type="text"
                value={meetingTitle}
                onChange={(event) => setMeetingTitle(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase text-slate-400">Data</span>
              <input
                type="date"
                value={meetingDate}
                onChange={(event) => setMeetingDate(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase text-slate-400">Projeto</span>
              <input
                list="ata-project-profiles"
                type="text"
                value={projeto}
                onChange={(event) => {
                  const nextProject = event.target.value;
                  setProjeto(nextProject);
                  applyProjectProfile(nextProject);
                }}
                placeholder="GERAL"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
              <datalist id="ata-project-profiles">
                {projectProfiles.map((profile) => (
                  <option key={profile.id} value={profile.projeto} />
                ))}
              </datalist>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase text-slate-400">Sprint</span>
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
            <span className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-400">
              <Users className="h-4 w-4" />
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
            <span className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-400">
              <Mail className="h-4 w-4" />
              Destinatarios de e-mail
            </span>
            <textarea
              value={destinatarios}
              onChange={(event) => setDestinatarios(event.target.value)}
              rows={2}
              placeholder="email1@empresa.com, email2@empresa.com"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </label>

          {validationError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {validationError}
            </div>
          )}

          {errorMessage && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-700 px-6 py-4">
          <p className="text-xs text-slate-500">
            A transcricao atual sera usada como entrada do pipeline multiagente.
          </p>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {isSubmitting ? "Executando pipeline..." : "Gerar ATA"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AtaGenerationModal;
