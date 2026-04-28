import { afterEach, describe, expect, it, vi } from "vitest";

import {
  preflightAtaPipeline,
  reprocessLatestAtaPipeline,
  runAtaPipeline,
} from "./ataPipelineService";

describe("ataPipelineService", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis as Record<string, unknown>, "require");
    vi.restoreAllMocks();
  });

  it("returns friendly error when Electron IPC is unavailable", async () => {
    Reflect.deleteProperty(globalThis as Record<string, unknown>, "require");
    const response = await runAtaPipeline({
      arquivoFonte: "f.mp3",
      transcriptText: "txt",
      projeto: "P",
      sprint: "S",
      participantes: ["Ana"],
      destinatarios: ["a@x.com"],
      meetingTitle: "T",
      meetingDate: "2026-04-13",
    });

    expect(response.success).toBe(false);
    expect(response.message).toContain("localhost");
    expect(response.message).toContain("Electron");
  });

  it("invokes Electron IPC channels when available", async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({ success: true, message: "ok" })
      .mockResolvedValueOnce({ success: true, message: "preflight", operation: "preflight" })
      .mockResolvedValueOnce({
        success: true,
        message: "reprocess",
        operation: "reprocess-latest",
      });

    (
      globalThis as Record<string, unknown> & {
        require: (moduleName: string) => unknown;
      }
    ).require = () => ({
      ipcRenderer: { invoke },
    });

    const run = await runAtaPipeline({
      arquivoFonte: "f.mp3",
      transcriptText: "txt",
      projeto: "P",
      sprint: "S",
      participantes: ["Ana"],
      destinatarios: ["a@x.com"],
      meetingTitle: "T",
      meetingDate: "2026-04-13",
    });
    const preflight = await preflightAtaPipeline();
    const reprocess = await reprocessLatestAtaPipeline(true);

    expect(run.success).toBe(true);
    expect(preflight.operation).toBe("preflight");
    expect(reprocess.operation).toBe("reprocess-latest");
    expect(invoke).toHaveBeenNthCalledWith(
      1,
      "ata-pipeline:run",
      expect.objectContaining({ projeto: "P" })
    );
    expect(invoke).toHaveBeenNthCalledWith(2, "ata-pipeline:preflight");
    expect(invoke).toHaveBeenNthCalledWith(3, "ata-pipeline:reprocess-latest", {
      dryRunEmail: true,
    });
  });
});
