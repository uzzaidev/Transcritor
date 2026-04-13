import { describe, expect, it } from "vitest";

import {
  OPENAI_WHISPER_PRICE_PER_MINUTE,
  calculateOpenAICost,
  formatCurrency,
} from "./costCalculator";

describe("costCalculator", () => {
  it("calculates whisper cost by minute", () => {
    const seconds = 90;
    const result = calculateOpenAICost(seconds);
    expect(result).toBe((seconds / 60) * OPENAI_WHISPER_PRICE_PER_MINUTE);
  });

  it("formats currency in USD", () => {
    expect(formatCurrency(0.01234)).toContain("$0.0123");
  });
});
