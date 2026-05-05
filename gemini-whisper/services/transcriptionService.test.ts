import { afterEach, describe, expect, it, vi } from "vitest";

import { transcribeMedia } from "./transcriptionService";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("transcriptionService", () => {
  it("uses OpenAI gpt-4o-transcribe for the OpenAI provider", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ text: "Transcricao gerada." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    globalThis.fetch = fetchMock as typeof fetch;

    const file = new File([new Uint8Array([1, 2, 3])], "meeting.webm", {
      type: "audio/webm",
    });

    const result = await transcribeMedia(
      file,
      "transcribe",
      "openai",
      { openai: "test-api-key", huggingface: "" }
    );

    const [, init] = fetchMock.mock.calls[0];
    const body = init?.body as FormData;

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/audio/transcriptions",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer test-api-key" },
      })
    );
    expect(body.get("model")).toBe("gpt-4o-transcribe");
    expect(result.provider).toBe("OpenAI gpt-4o-transcribe");
    expect(result.text).toBe("Transcricao gerada.");
  });
});
