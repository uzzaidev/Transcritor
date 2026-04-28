import { AtaPipelineExecutionResult, AtaPipelineRequest } from "../types";

type ElectronApi = {
  ipcRenderer?: {
    invoke: (channel: string, payload: unknown) => Promise<unknown>;
  };
};

const isElectronRenderer = (): boolean => {
  const maybeProcess = globalThis as typeof globalThis & {
    process?: {
      versions?: {
        electron?: string;
      };
    };
  };

  return Boolean(maybeProcess.process?.versions?.electron);
};

const getUnavailableMessage = (operationLabel: string): string => {
  if (isElectronRenderer()) {
    return `Electron carregou sem IPC do renderer. Feche esta janela e reabra a app Electron para ${operationLabel}.`;
  }

  return `Esta tela está aberta no navegador (localhost), não na janela do Electron. Abra a app Electron para ${operationLabel}.`;
};

const getElectronApi = (): ElectronApi | null => {
  const globalWithRequire = globalThis as typeof globalThis & {
    require?: (moduleName: string) => ElectronApi;
  };

  if (typeof globalWithRequire.require !== "function") {
    return null;
  }

  try {
    return globalWithRequire.require("electron");
  } catch (_error) {
    return null;
  }
};

export const runAtaPipeline = async (
  payload: AtaPipelineRequest
): Promise<AtaPipelineExecutionResult> => {
  const electron = getElectronApi();
  if (!electron?.ipcRenderer) {
    return {
      success: false,
      message: getUnavailableMessage("gerar a ATA"),
    };
  }

  const response = await electron.ipcRenderer.invoke("ata-pipeline:run", payload);
  return response as AtaPipelineExecutionResult;
};

export const preflightAtaPipeline = async (): Promise<AtaPipelineExecutionResult> => {
  const electron = getElectronApi();
  if (!electron?.ipcRenderer) {
    return {
      success: false,
      message: getUnavailableMessage("usar o preflight"),
      operation: "preflight",
    };
  }

  const response = await electron.ipcRenderer.invoke("ata-pipeline:preflight");
  return response as AtaPipelineExecutionResult;
};

export const reprocessLatestAtaPipeline = async (
  dryRunEmail: boolean
): Promise<AtaPipelineExecutionResult> => {
  const electron = getElectronApi();
  if (!electron?.ipcRenderer) {
    return {
      success: false,
      message: getUnavailableMessage("reprocessar eventos"),
      operation: "reprocess-latest",
    };
  }

  const response = await electron.ipcRenderer.invoke("ata-pipeline:reprocess-latest", { dryRunEmail });
  return response as AtaPipelineExecutionResult;
};

export const cleanupGeneratedAtaArtifacts = async (): Promise<AtaPipelineExecutionResult> => {
  const electron = getElectronApi();
  if (!electron?.ipcRenderer) {
    return {
      success: false,
      message: getUnavailableMessage("limpar artefatos"),
      operation: "cleanup-generated",
    };
  }

  const response = await electron.ipcRenderer.invoke("ata-pipeline:cleanup-generated");
  return response as AtaPipelineExecutionResult;
};
