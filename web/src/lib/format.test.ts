import { describe, expect, it } from "vitest";

import { compactNumber, dateLabel, money, percent } from "./format";

describe("format helpers", () => {
  it("formats currency values", () => {
    expect(money(1234.5, "USD")).toContain("$");
  });

  it("formats percentages with explicit sign", () => {
    expect(percent(12.34)).toBe("+12.3%");
    expect(percent(-4.1)).toBe("-4.1%");
  });

  it("formats compact numbers", () => {
    expect(compactNumber(12345)).toContain("12");
  });

  it("formats date labels", () => {
    expect(dateLabel("2026-04-07")).toContain("апр");
  });
});
