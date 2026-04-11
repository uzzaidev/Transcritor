import { AtaPipelineExecutionResult, AtaPipelineRequest } from "../types";

type ElectronApi = {
  ipcRenderer?: {
    invoke: (channel: string, payload: unknown) => Promise<unknown>;
  };
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
      message: "Electron IPC indisponível neste ambiente.",
    };
  }

  const response = await electron.ipcRenderer.invoke("ata-pipeline:run", payload);
  return response as AtaPipelineExecutionResult;
};
