import { useEffect, useState } from "react";

import { getSecureStorageCapabilities, loadSecureApiKeys, saveSecureApiKeys } from "../services/secureSettingsService";
import { ApiKeys, AtaPipelineDefaults, AtaProjectProfile, TranscriptionProvider } from "../types";
import { getCurrentSprintLabel } from "../utils/pipelineHelpers";

export const useAppSettings = () => {
  const [secureStorageStatus, setSecureStorageStatus] = useState<{
    available: boolean;
    reason: string;
  }>({
    available: false,
    reason: "not_checked",
  });

  const [provider, setProvider] = useState<TranscriptionProvider>(() => {
    const saved = localStorage.getItem("gw_provider");
    return (saved as TranscriptionProvider) || "gemini";
  });

  const [apiKeys, setApiKeys] = useState<ApiKeys>(() => ({
    openai: process.env.OPENAI_API_KEY || "",
    huggingface: "",
  }));

  const [ataDefaults, setAtaDefaults] = useState<AtaPipelineDefaults>(() => {
    const saved = localStorage.getItem("gw_ataDefaults");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          projeto: parsed.projeto || "GERAL",
          sprint: parsed.sprint || getCurrentSprintLabel(),
          participantes: parsed.participantes || "",
          destinatarios: parsed.destinatarios || "",
          autoGenerateAta: Boolean(parsed.autoGenerateAta),
          projectProfiles: Array.isArray(parsed.projectProfiles)
            ? parsed.projectProfiles.map((profile: AtaProjectProfile) => ({
                id: profile.id || Math.random().toString(36).slice(2, 10),
                projeto: profile.projeto || "",
                sprint: profile.sprint || "",
                participantes: profile.participantes || "",
                destinatarios: profile.destinatarios || "",
              }))
            : [],
        };
      } catch (error) {
        console.error("Failed to parse ATA defaults", error);
      }
    }

    return {
      projeto: "GERAL",
      sprint: getCurrentSprintLabel(),
      participantes: "",
      destinatarios: "",
      autoGenerateAta: false,
      projectProfiles: [],
    };
  });

  useEffect(() => {
    localStorage.setItem("gw_provider", provider);
  }, [provider]);

  useEffect(() => {
    localStorage.setItem("gw_ataDefaults", JSON.stringify(ataDefaults));
  }, [ataDefaults]);

  useEffect(() => {
    let cancelled = false;

    const loadSecureSettings = async () => {
      const capabilities = await getSecureStorageCapabilities();
      if (cancelled) return;

      setSecureStorageStatus({
        available: capabilities.available,
        reason: capabilities.reason || "",
      });

      if (!capabilities.available) return;

      const secureKeys = await loadSecureApiKeys();
      if (cancelled || !secureKeys) return;
      setApiKeys((previous) => ({
        ...previous,
        ...secureKeys,
      }));
    };

    loadSecureSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!secureStorageStatus.available) return;
    saveSecureApiKeys(apiKeys).catch((error) => {
      console.error("Failed to persist secure API keys", error);
    });
  }, [apiKeys, secureStorageStatus.available]);

  return {
    provider,
    setProvider,
    apiKeys,
    setApiKeys,
    ataDefaults,
    setAtaDefaults,
    secureStorageStatus,
  };
};
