import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import {
  cleanupGeneratedAtaArtifacts,
  preflightAtaPipeline,
  reprocessLatestAtaPipeline,
  runAtaPipeline,
} from "../services/ataPipelineService";
import { AtaPipelineDefaults, AtaPipelineExecutionResult, ProcessStatus, QueueItem } from "../types";
import {
  canAutoGenerateAta,
  findProjectProfile,
  parseCommaSeparatedValues,
} from "../utils/pipelineHelpers";

type AtaSubmitPayload = {
  projeto: string;
  sprint: string;
  participantes: string;
  destinatarios: string;
  meetingTitle: string;
  meetingDate: string;
};

type UseAtaPipelineParams = {
  queue: QueueItem[];
  setQueue: Dispatch<SetStateAction<QueueItem[]>>;
  ataDefaults: AtaPipelineDefaults;
  setAtaDefaults: Dispatch<SetStateAction<AtaPipelineDefaults>>;
};

export const useAtaPipeline = ({
  queue,
  setQueue,
  ataDefaults,
  setAtaDefaults,
}: UseAtaPipelineParams) => {
  const [ataModalItemId, setAtaModalItemId] = useState<string | null>(null);
  const [ataPipelineError, setAtaPipelineError] = useState<string | null>(null);
  const [isRunningAtaPipeline, setIsRunningAtaPipeline] = useState(false);
  const [pipelineOpsState, setPipelineOpsState] = useState<{
    running: boolean;
    message: string | null;
    result: AtaPipelineExecutionResult | null;
  }>({
    running: false,
    message: null,
    result: null,
  });

  const ataModalItem = useMemo(
    () => (ataModalItemId ? queue.find((item) => item.id === ataModalItemId) || null : null),
    [ataModalItemId, queue]
  );

  const executeAtaPipelineForItem = useCallback(
    async (
      item: QueueItem,
      payload: AtaSubmitPayload,
      options?: {
        closeModalOnSuccess?: boolean;
        surfaceErrorsInModal?: boolean;
      }
    ) => {
      if (!item.result) {
        if (options?.surfaceErrorsInModal) {
          setAtaPipelineError("Nenhuma transcricao disponivel para este item.");
        }
        return;
      }

      setIsRunningAtaPipeline(true);
      if (options?.surfaceErrorsInModal) {
        setAtaPipelineError(null);
      }

      setAtaDefaults((previous) => ({
        projeto: payload.projeto,
        sprint: payload.sprint,
        participantes: payload.participantes,
        destinatarios: payload.destinatarios,
        autoGenerateAta: previous.autoGenerateAta,
        projectProfiles: previous.projectProfiles,
      }));

      const itemId = item.id;
      setQueue((previous) =>
        previous.map((queueItem) =>
          queueItem.id === itemId
            ? {
                ...queueItem,
                ataPipelineStatus: "running",
                ataPipelineMessage: "Executando pipeline de ATA...",
              }
            : queueItem
        )
      );

      try {
        const result = await runAtaPipeline({
          arquivoFonte: item.file.name,
          transcriptText: item.result.text,
          projeto: payload.projeto,
          sprint: payload.sprint,
          participantes: parseCommaSeparatedValues(payload.participantes),
          destinatarios: parseCommaSeparatedValues(payload.destinatarios),
          meetingTitle: payload.meetingTitle,
          meetingDate: payload.meetingDate,
        });

        setQueue((previous) =>
          previous.map((queueItem) =>
            queueItem.id === itemId
              ? {
                  ...queueItem,
                  ataPipelineStatus: result.success ? "success" : "error",
                  ataPipelineMessage: result.message,
                  ataPipelineResult: result,
                }
              : queueItem
          )
        );
        setPipelineOpsState({
          running: false,
          message: result.message,
          result,
        });

        if (result.success && options?.closeModalOnSuccess) {
          setAtaModalItemId(null);
        } else if (!result.success && options?.surfaceErrorsInModal) {
          setAtaPipelineError(result.message);
        }
      } catch (error: any) {
        const message = error?.message || "Falha inesperada ao executar o pipeline.";
        setQueue((previous) =>
          previous.map((queueItem) =>
            queueItem.id === itemId
              ? {
                  ...queueItem,
                  ataPipelineStatus: "error",
                  ataPipelineMessage: message,
                }
              : queueItem
          )
        );
        if (options?.surfaceErrorsInModal) {
          setAtaPipelineError(message);
        }
        setPipelineOpsState({
          running: false,
          message,
          result: null,
        });
      } finally {
        setIsRunningAtaPipeline(false);
      }
    },
    [setAtaDefaults, setQueue]
  );

  const handleAtaPipelineSubmit = useCallback(
    async (payload: AtaSubmitPayload) => {
      if (!ataModalItem) {
        setAtaPipelineError("Nenhum item selecionado para gerar ATA.");
        return;
      }
      await executeAtaPipelineForItem(ataModalItem, payload, {
        closeModalOnSuccess: true,
        surfaceErrorsInModal: true,
      });
    },
    [ataModalItem, executeAtaPipelineForItem]
  );

  const handleOpenAtaModal = useCallback((itemId: string) => {
    setAtaPipelineError(null);
    setAtaModalItemId(itemId);
  }, []);

  const handlePreflightPipeline = useCallback(async () => {
    setPipelineOpsState({
      running: true,
      message: "Executando preflight do pipeline...",
      result: null,
    });
    try {
      const result = await preflightAtaPipeline();
      setPipelineOpsState({ running: false, message: result.message, result });
    } catch (error: any) {
      setPipelineOpsState({
        running: false,
        message: error?.message || "Falha ao executar o preflight do pipeline.",
        result: null,
      });
    }
  }, []);

  const handleReprocessLatestPipeline = useCallback(async (dryRunEmail: boolean) => {
    setPipelineOpsState({
      running: true,
      message: dryRunEmail
        ? "Reprocessando o ultimo evento em dry-run..."
        : "Reprocessando o ultimo evento com envio real...",
      result: null,
    });
    try {
      const result = await reprocessLatestAtaPipeline(dryRunEmail);
      setPipelineOpsState({ running: false, message: result.message, result });
    } catch (error: any) {
      setPipelineOpsState({
        running: false,
        message: error?.message || "Falha ao reprocessar o ultimo evento.",
        result: null,
      });
    }
  }, []);

  const handleCleanupGeneratedArtifacts = useCallback(async () => {
    setPipelineOpsState({
      running: true,
      message: "Limpando artefatos legados do pipeline...",
      result: null,
    });
    try {
      const result = await cleanupGeneratedAtaArtifacts();
      setPipelineOpsState({ running: false, message: result.message, result });
    } catch (error: any) {
      setPipelineOpsState({
        running: false,
        message: error?.message || "Falha ao limpar artefatos legados.",
        result: null,
      });
    }
  }, []);

  useEffect(() => {
    if (isRunningAtaPipeline) {
      return;
    }

    const pendingAutoItem = queue.find(
      (item) =>
        item.status === ProcessStatus.COMPLETED &&
        item.processedMode === "transcribe" &&
        item.result &&
        !item.ataPipelineStatus &&
        (item.autoRunAta || canAutoGenerateAta(ataDefaults))
    );

    if (!pendingAutoItem) {
      return;
    }

    const participantsFromProfiles = pendingAutoItem.result?.speakerProfiles
      ?.map((profile) => profile.displayName)
      .join(", ");
    const fallbackTitle =
      pendingAutoItem.meetingTitle ||
      pendingAutoItem.file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() ||
      "Nova reuniao";
    const matchedProfile = findProjectProfile(ataDefaults.projectProfiles, ataDefaults.projeto);
    const projeto = matchedProfile?.projeto || ataDefaults.projeto;
    const sprint = matchedProfile?.sprint || ataDefaults.sprint;
    const participantes =
      participantsFromProfiles || matchedProfile?.participantes || ataDefaults.participantes;
    const destinatarios = matchedProfile?.destinatarios || ataDefaults.destinatarios;

    if (!projeto.trim() || !sprint.trim() || !destinatarios.trim()) {
      setQueue((previous) =>
        previous.map((queueItem) =>
          queueItem.id === pendingAutoItem.id
            ? {
                ...queueItem,
                ataPipelineStatus: "error",
                ataPipelineMessage:
                  "Configure projeto, sprint e destinatarios em Settings antes de usar o modo reuniao com envio automatico.",
              }
            : queueItem
        )
      );
      return;
    }

    void executeAtaPipelineForItem(pendingAutoItem, {
      projeto,
      sprint,
      participantes,
      destinatarios,
      meetingTitle: fallbackTitle,
      meetingDate: new Date().toISOString().slice(0, 10),
    });
  }, [ataDefaults, executeAtaPipelineForItem, isRunningAtaPipeline, queue]);

  return {
    ataModalItemId,
    setAtaModalItemId,
    ataModalItem,
    ataPipelineError,
    isRunningAtaPipeline,
    pipelineOpsState,
    handleAtaPipelineSubmit,
    handleOpenAtaModal,
    handlePreflightPipeline,
    handleReprocessLatestPipeline,
    handleCleanupGeneratedArtifacts,
  };
};
