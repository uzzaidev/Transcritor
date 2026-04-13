import { describe, expect, it } from "vitest";

import {
  buildDefaultTitle,
  normalizeCsvList,
  prepareAtaSubmissionPayload,
} from "./ataGenerationValidation";

describe("ataGenerationValidation", () => {
  it("normalizes list values separated by comma, semicolon, and newline", () => {
    expect(normalizeCsvList("a@x.com; b@x.com\nc@x.com")).toEqual([
      "a@x.com",
      "b@x.com",
      "c@x.com",
    ]);
  });

  it("rejects submit when recipients are missing", () => {
    const result = prepareAtaSubmissionPayload({
      projeto: "",
      sprint: "S-1",
      participantes: "Ana",
      destinatarios: "   ",
      meetingTitle: "",
      meetingDate: "",
      fallbackTitle: "Reuniao X",
      todayIso: "2026-04-13",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("destinatario");
    }
  });

  it("applies defaults and trimming on valid submit", () => {
    const result = prepareAtaSubmissionPayload({
      projeto: "  ",
      sprint: " S-2 ",
      participantes: " Ana, Bob ",
      destinatarios: "a@x.com, b@x.com",
      meetingTitle: " ",
      meetingDate: "",
      fallbackTitle: "Minha Reuniao",
      todayIso: "2026-04-13",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.projeto).toBe("GERAL");
      expect(result.payload.sprint).toBe("S-2");
      expect(result.payload.meetingTitle).toBe("Minha Reuniao");
      expect(result.payload.meetingDate).toBe("2026-04-13");
      expect(result.payload.destinatarios).toBe("a@x.com, b@x.com");
    }
  });

  it("builds title from file name", () => {
    expect(buildDefaultTitle("reuniao_planejamento-abril.mp3")).toBe(
      "reuniao planejamento abril"
    );
  });
});
