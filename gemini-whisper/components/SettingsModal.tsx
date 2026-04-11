import React, { useState, useEffect } from 'react';
import { X, Key, Save, CheckCircle2 } from 'lucide-react';
import { ApiKeys, AtaPipelineDefaults, TranscriptionProvider } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKeys: ApiKeys;
  setApiKeys: (keys: ApiKeys) => void;
  provider: TranscriptionProvider;
  setProvider: (provider: TranscriptionProvider) => void;
  ataDefaults: AtaPipelineDefaults;
  setAtaDefaults: (defaults: AtaPipelineDefaults) => void;
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
}) => {
  const [localKeys, setLocalKeys] = useState<ApiKeys>(apiKeys);
  const [localAtaDefaults, setLocalAtaDefaults] = useState<AtaPipelineDefaults>(ataDefaults);
  const [saved, setSaved] = useState(false);

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl transform transition-all animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
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

        <div className="p-6 space-y-6">
          
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
          </div>

          {/* API Keys */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
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

        </div>

        <div className="p-6 border-t border-slate-800 flex justify-end">
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
