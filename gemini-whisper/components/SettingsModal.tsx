import React, { useState, useEffect } from 'react';
import { X, Key, Save, CheckCircle2, Plus, Trash2, Activity, RefreshCw, FlaskConical, BrushCleaning } from 'lucide-react';
import { ApiKeys, AtaPipelineDefaults, AtaPipelineExecutionResult, AtaProjectProfile, TranscriptionProvider } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKeys: ApiKeys;
  setApiKeys: (keys: ApiKeys) => void;
  provider: TranscriptionProvider;
  setProvider: (provider: TranscriptionProvider) => void;
  ataDefaults: AtaPipelineDefaults;
  setAtaDefaults: (defaults: AtaPipelineDefaults) => void;
  secureStorageStatus: {
    available: boolean;
    reason: string;
  };
  pipelineOpsState: {
    running: boolean;
    message: string | null;
    result: AtaPipelineExecutionResult | null;
  };
  onPreflight: () => void;
  onReprocessLatest: (dryRunEmail: boolean) => void;
  onCleanupGenerated: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  apiKeys,
  setApiKeys,
  provider,
  setProvider,
  ataDefaults,
  setAtaDefaults,
  secureStorageStatus,
  pipelineOpsState,
  onPreflight,
  onReprocessLatest,
  onCleanupGenerated,
}) => {
  const [localKeys, setLocalKeys] = useState<ApiKeys>(apiKeys);
  const [localAtaDefaults, setLocalAtaDefaults] = useState<AtaPipelineDefaults>(ataDefaults);
  const [saved, setSaved] = useState(false);
  const preflight = pipelineOpsState.result?.preflight;
  const lastRunState = pipelineOpsState.result?.result?.state;
  const validation = lastRunState?.validation_result;
  const delivery = lastRunState?.delivery_result;
  const audit = lastRunState?.audit_result;
  const derivedCount = lastRunState?.arquivos_derivados?.length || 0;

  const yesNo = (value: boolean | undefined): string => value ? 'Sim' : 'Não';
  const healthCardClass = (value: boolean | undefined): string =>
    value
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
      : 'border-amber-500/30 bg-amber-500/10 text-amber-100';
  const autoAtaDefaultsReady = Boolean(
    localAtaDefaults.projeto.trim() &&
    localAtaDefaults.sprint.trim() &&
    localAtaDefaults.destinatarios.trim()
  );
  const manualOpsReady = Boolean(preflight?.openai_configured && preflight?.smtp_ready && preflight?.smtp_login_verified);
  const automaticOpsReady = Boolean(manualOpsReady && localAtaDefaults.autoGenerateAta && autoAtaDefaultsReady);
  const readinessTitle = automaticOpsReady
    ? 'Pronto para operação automática'
    : manualOpsReady
      ? 'Pronto para operação manual'
      : 'Ajustes pendentes';

  const updateProjectProfile = (profileId: string, patch: Partial<AtaProjectProfile>) => {
    setLocalAtaDefaults({
      ...localAtaDefaults,
      projectProfiles: localAtaDefaults.projectProfiles.map((profile) =>
        profile.id === profileId ? { ...profile, ...patch } : profile
      ),
    });
  };

  const addProjectProfile = () => {
    setLocalAtaDefaults({
      ...localAtaDefaults,
      projectProfiles: [
        ...localAtaDefaults.projectProfiles,
        {
          id: Math.random().toString(36).slice(2, 10),
          projeto: '',
          sprint: localAtaDefaults.sprint,
          participantes: localAtaDefaults.participantes,
          destinatarios: localAtaDefaults.destinatarios,
        },
      ],
    });
  };

  const removeProjectProfile = (profileId: string) => {
    setLocalAtaDefaults({
      ...localAtaDefaults,
      projectProfiles: localAtaDefaults.projectProfiles.filter((profile) => profile.id !== profileId),
    });
  };

  // Sync props to local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalKeys(apiKeys);
      setLocalAtaDefaults(ataDefaults);
      setSaved(false);
    }
  }, [isOpen, apiKeys, ataDefaults]);

  const handleSave = () => {
    setApiKeys(localKeys);
    setAtaDefaults(localAtaDefaults);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl transform transition-all animate-scale-in sm:max-h-[calc(100vh-3rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-center justify-between p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-400" />
            Configuration
          </h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-6 overscroll-contain">
          
          {/* Provider Selection */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              AI Provider
            </label>
            <div className="grid grid-cols-1 gap-3">
              {[
                { id: 'gemini', name: 'Google Gemini', desc: 'Fast, Multimodal, Built-in' },
                { id: 'openai', name: 'OpenAI Whisper', desc: 'Industry Standard ASR' },
                { id: 'huggingface', name: 'Hugging Face', desc: 'Whisper Large v3 (Free/Pro)' }
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProvider(p.id as TranscriptionProvider)}
                  className={`
                    flex items-center justify-between p-3 rounded-lg border text-left transition-all
                    ${provider === p.id 
                      ? 'border-blue-500 bg-blue-500/10 text-white' 
                      : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:bg-slate-800'}
                  `}
                >
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs opacity-60">{p.desc}</div>
                  </div>
                  {provider === p.id && <CheckCircle2 className="w-5 h-5 text-blue-400" />}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setLocalAtaDefaults({ ...localAtaDefaults, autoGenerateAta: !localAtaDefaults.autoGenerateAta })}
              className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all
                ${localAtaDefaults.autoGenerateAta
                  ? 'border-emerald-500 bg-emerald-500/10 text-white'
                  : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'}`}
            >
              <div className="text-left">
                <p className="font-medium text-sm">Gerar ATA automaticamente</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ao concluir a transcricao, tenta rodar o pipeline usando os padroes salvos.
                </p>
              </div>
              <div className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${localAtaDefaults.autoGenerateAta ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${localAtaDefaults.autoGenerateAta ? 'translate-x-5' : 'translate-x-1'}`}></div>
              </div>
            </button>
          </div>

          {/* API Keys */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div
              className={`rounded-lg border px-3 py-2 text-xs ${
                secureStorageStatus.available
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-100'
              }`}
            >
              {secureStorageStatus.available
                ? 'Armazenamento seguro ativo: chaves ficam criptografadas no app Electron.'
                : `Armazenamento seguro indisponivel (${secureStorageStatus.reason || 'unknown'}). Chaves ficam apenas em memoria nesta sessao.`}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase">
                OpenAI API Key
              </label>
              <input 
                type="password"
                value={localKeys.openai}
                onChange={(e) => setLocalKeys({ ...localKeys, openai: e.target.value })}
                placeholder="sk-..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase">
                Hugging Face Token
              </label>
              <input 
                type="password"
                value={localKeys.huggingface}
                onChange={(e) => setLocalKeys({ ...localKeys, huggingface: e.target.value })}
                placeholder="hf_..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              ATA Pipeline Defaults
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase">
                Projeto padrão
              </label>
              <input
                type="text"
                value={localAtaDefaults.projeto}
                onChange={(e) => setLocalAtaDefaults({ ...localAtaDefaults, projeto: e.target.value })}
                placeholder="GERAL"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase">
                Sprint padrão
              </label>
              <input
                type="text"
                value={localAtaDefaults.sprint}
                onChange={(e) => setLocalAtaDefaults({ ...localAtaDefaults, sprint: e.target.value })}
                placeholder="Sprint-2026-W15"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase">
                Participantes padrão
              </label>
              <textarea
                value={localAtaDefaults.participantes}
                onChange={(e) => setLocalAtaDefaults({ ...localAtaDefaults, participantes: e.target.value })}
                rows={2}
                placeholder="Nome 1, Nome 2"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase">
                Destinatários padrão
              </label>
              <textarea
                value={localAtaDefaults.destinatarios}
                onChange={(e) => setLocalAtaDefaults({ ...localAtaDefaults, destinatarios: e.target.value })}
                rows={2}
                placeholder="ata@empresa.com, time@empresa.com"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                Perfis por Projeto
              </div>
              <button
                type="button"
                onClick={addProjectProfile}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Novo perfil
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Salve participantes, sprint e destinatários por projeto para reduzir erros na geração automática.
            </p>

            <div className="space-y-4">
              {localAtaDefaults.projectProfiles.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-700 px-4 py-4 text-sm text-slate-500">
                  Nenhum perfil salvo ainda.
                </div>
              ) : localAtaDefaults.projectProfiles.map((profile) => (
                <div key={profile.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <input
                      type="text"
                      value={profile.projeto}
                      onChange={(e) => updateProjectProfile(profile.id, { projeto: e.target.value })}
                      placeholder="Nome do projeto"
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeProjectProfile(profile.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                      aria-label="Remover perfil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <input
                    type="text"
                    value={profile.sprint}
                    onChange={(e) => updateProjectProfile(profile.id, { sprint: e.target.value })}
                    placeholder="Sprint padrão"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />

                  <textarea
                    value={profile.participantes}
                    onChange={(e) => updateProjectProfile(profile.id, { participantes: e.target.value })}
                    rows={2}
                    placeholder="Participantes padrão"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />

                  <textarea
                    value={profile.destinatarios}
                    onChange={(e) => updateProjectProfile(profile.id, { destinatarios: e.target.value })}
                    rows={2}
                    placeholder="Destinatários padrão"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              Operação Assistida
            </div>

            <div className="grid gap-3">
              <button
                type="button"
                onClick={onPreflight}
                disabled={pipelineOpsState.running}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-700 transition-colors disabled:opacity-60"
              >
                <Activity className="w-4 h-4" />
                Executar preflight
              </button>

              <button
                type="button"
                onClick={() => onReprocessLatest(true)}
                disabled={pipelineOpsState.running}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-100 hover:bg-blue-500/20 transition-colors disabled:opacity-60"
              >
                <FlaskConical className="w-4 h-4" />
                Reprocessar último evento em dry-run
              </button>

              <button
                type="button"
                onClick={() => onReprocessLatest(false)}
                disabled={pipelineOpsState.running}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20 transition-colors disabled:opacity-60"
              >
                <RefreshCw className="w-4 h-4" />
                Reprocessar último evento com envio real
              </button>

              <button
                type="button"
                onClick={onCleanupGenerated}
                disabled={pipelineOpsState.running}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100 hover:bg-amber-500/20 transition-colors disabled:opacity-60"
              >
                <BrushCleaning className="w-4 h-4" />
                Limpar artefatos legados
              </button>
            </div>

            {pipelineOpsState.message && (
              <div className={`rounded-lg border px-4 py-3 text-sm ${
                pipelineOpsState.result?.success
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-100'
              }`}>
                <p className="font-medium">{pipelineOpsState.message}</p>
                {pipelineOpsState.result?.preflight ? (
                  <p className="mt-2 text-xs opacity-80">
                    SMTP pronto: {pipelineOpsState.result.preflight.smtp_ready ? 'sim' : 'não'} | Evento disponível: {pipelineOpsState.result.preflight.runtime_events_ready ? 'sim' : 'não'}
                  </p>
                ) : null}
                {pipelineOpsState.result?.preflight?.latest_runtime_event ? (
                  <p className="mt-1 text-xs opacity-80 break-all">
                    Último evento: {pipelineOpsState.result.preflight.latest_runtime_event}
                  </p>
                ) : null}
                {pipelineOpsState.result?.maintenance ? (
                  <p className="mt-2 text-xs opacity-80">
                    Arquivos verificados: {pipelineOpsState.result.maintenance.scanned_files || 0} | Arquivados: {pipelineOpsState.result.maintenance.archived_files?.length || 0}
                  </p>
                ) : null}
              </div>
            )}

            {preflight ? (
              <div className="grid grid-cols-2 gap-3">
                <div className={`rounded-xl border px-4 py-3 ${healthCardClass(preflight.openai_configured)}`}>
                  <p className="text-[11px] uppercase tracking-wide opacity-80">OpenAI</p>
                  <p className="mt-1 text-sm font-semibold">{yesNo(preflight.openai_configured)}</p>
                </div>
                <div className={`rounded-xl border px-4 py-3 ${healthCardClass(preflight.smtp_ready)}`}>
                  <p className="text-[11px] uppercase tracking-wide opacity-80">SMTP Config</p>
                  <p className="mt-1 text-sm font-semibold">{yesNo(preflight.smtp_ready)}</p>
                </div>
                <div className={`rounded-xl border px-4 py-3 ${healthCardClass(preflight.smtp_login_verified)}`}>
                  <p className="text-[11px] uppercase tracking-wide opacity-80">SMTP Login</p>
                  <p className="mt-1 text-sm font-semibold">{yesNo(preflight.smtp_login_verified)}</p>
                </div>
                <div className={`rounded-xl border px-4 py-3 ${healthCardClass(preflight.runtime_events_ready)}`}>
                  <p className="text-[11px] uppercase tracking-wide opacity-80">Runtime Event</p>
                  <p className="mt-1 text-sm font-semibold">{yesNo(preflight.runtime_events_ready)}</p>
                </div>
              </div>
            ) : null}

            {preflight?.smtp_verify_error ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                <p className="font-medium">Falha na verificação SMTP</p>
                <p className="mt-1 text-xs opacity-80 break-words">{preflight.smtp_verify_error}</p>
              </div>
            ) : null}

            {lastRunState ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                <div className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                  Última execução
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Validação</p>
                    <p className="mt-1 text-slate-100 font-medium">
                      {validation?.valid ? `OK (${validation.score ?? 0})` : `Pendente (${validation?.score ?? 0})`}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Artefatos</p>
                    <p className="mt-1 text-slate-100 font-medium">{derivedCount}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Entrega</p>
                    <p className="mt-1 text-slate-100 font-medium">
                      {delivery?.success ? 'E-mail enviado' : (delivery?.error || 'Sem envio')}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Auditoria</p>
                    <p className="mt-1 text-slate-100 font-medium">
                      {audit?.passed ? 'Aprovada' : 'Com pendências'}
                    </p>
                  </div>
                </div>

                {validation?.warnings?.length ? (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                    <p className="font-medium">Warnings</p>
                    <p className="mt-1 break-words">{validation.warnings.join(', ')}</p>
                  </div>
                ) : null}

                {audit?.issues?.length ? (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                    <p className="font-medium">Issues de auditoria</p>
                    <p className="mt-1 break-words">{audit.issues.join(', ')}</p>
                  </div>
                ) : null}

                {delivery?.sent_at ? (
                  <p className="text-xs text-slate-500 break-words">
                    Último envio: {delivery.sent_at}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className={`rounded-xl border px-4 py-4 ${
              automaticOpsReady
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                : manualOpsReady
                  ? 'border-blue-500/30 bg-blue-500/10 text-blue-100'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-100'
            }`}>
              <p className="text-sm font-semibold">{readinessTitle}</p>
              <div className="mt-3 space-y-2 text-xs opacity-90">
                <p>OpenAI configurado: {yesNo(preflight?.openai_configured)}</p>
                <p>SMTP autenticado: {yesNo(preflight?.smtp_login_verified)}</p>
                <p>Projeto padrão preenchido: {yesNo(Boolean(localAtaDefaults.projeto.trim()))}</p>
                <p>Sprint padrão preenchida: {yesNo(Boolean(localAtaDefaults.sprint.trim()))}</p>
                <p>Destinatários padrão preenchidos: {yesNo(Boolean(localAtaDefaults.destinatarios.trim()))}</p>
                <p>Auto ATA habilitada: {yesNo(localAtaDefaults.autoGenerateAta)}</p>
              </div>
            </div>
          </div>

        </div>

        <div className="flex flex-shrink-0 justify-end gap-3 border-t border-slate-800 bg-slate-900/95 p-6">
          <button
            onClick={onClose}
            className="flex items-center gap-2 rounded-xl border border-slate-700 px-6 py-2.5 text-sm font-semibold text-slate-200 transition-all hover:bg-slate-800"
          >
            Fechar
          </button>
          <button
            onClick={handleSave}
            className={`
              flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all
              ${saved 
                ? 'bg-green-500 text-white' 
                : 'bg-white text-slate-900 hover:bg-slate-200'}
            `}
          >
            {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
