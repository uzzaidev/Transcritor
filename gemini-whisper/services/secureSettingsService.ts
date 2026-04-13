import { ApiKeys } from "../types";

type ElectronApi = {
  ipcRenderer?: {
    invoke: (channel: string, payload?: unknown) => Promise<unknown>;
  };
};

type SecureCapabilities = {
  available: boolean;
  reason?: string;
};

type SecureLoadResponse = {
  success: boolean;
  reason?: string;
  data: {
    apiKeys?: ApiKeys;
  } | null;
};

type SecureSaveResponse = {
  success: boolean;
  reason?: string;
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
  } catch {
    return null;
  }
};

export const getSecureStorageCapabilities = async (): Promise<SecureCapabilities> => {
  const electron = getElectronApi();
  if (!electron?.ipcRenderer) {
    return {
      available: false,
      reason: "electron_ipc_unavailable",
    };
  }

  try {
    const response = (await electron.ipcRenderer.invoke(
      "settings:secure-capabilities"
    )) as SecureCapabilities;
    return response;
  } catch (error) {
    return {
      available: false,
      reason: error instanceof Error ? error.message : "secure_capabilities_error",
    };
  }
};

export const loadSecureApiKeys = async (): Promise<ApiKeys | null> => {
  const electron = getElectronApi();
  if (!electron?.ipcRenderer) {
    return null;
  }

  try {
    const response = (await electron.ipcRenderer.invoke(
      "settings:secure-load"
    )) as SecureLoadResponse;
    if (!response.success) return null;
    return response.data?.apiKeys || null;
  } catch {
    return null;
  }
};

export const saveSecureApiKeys = async (apiKeys: ApiKeys): Promise<boolean> => {
  const electron = getElectronApi();
  if (!electron?.ipcRenderer) {
    return false;
  }

  try {
    const response = (await electron.ipcRenderer.invoke(
      "settings:secure-save",
      { apiKeys }
    )) as SecureSaveResponse;
    return Boolean(response.success);
  } catch {
    return false;
  }
};
