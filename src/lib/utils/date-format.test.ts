import { describe, it, expect } from "vitest";
import { formatDate, formatDateTime, formatRelativeTime, formatRelativeShort } from "./date-format";

describe("formatDate", () => {
  it("returns '-' for null/undefined", () => {
    expect(formatDate(null)).toBe("-");
    expect(formatDate(undefined)).toBe("-");
  });

  it("formats a Date object", () => {
    const date = new Date("2026-03-05T10:30:00Z");
    const result = formatDate(date);
    expect(result).toMatch(/05\/03\/2026/);
  });

  it("formats a date string", () => {
    const result = formatDate("2026-01-15T00:00:00Z");
    expect(result).toMatch(/15\/01\/2026/);
  });
});

describe("formatDateTime", () => {
  it("returns '-' for null/undefined", () => {
    expect(formatDateTime(null)).toBe("-");
    expect(formatDateTime(undefined)).toBe("-");
  });

  it("formats date and time", () => {
    const date = new Date("2026-03-05T10:30:00Z");
    const result = formatDateTime(date);
    expect(result).toContain("05/03/2026");
  });
});

describe("formatRelativeTime", () => {
  it("returns '-' for null/undefined", () => {
    expect(formatRelativeTime(null)).toBe("-");
  });

  it("returns 'hace unos segundos' for very recent dates", () => {
    const now = new Date();
    expect(formatRelativeTime(now)).toBe("hace unos segundos");
  });

  it("returns minutes for dates within the last hour", () => {
    const date = new Date(Date.now() - 30 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe("hace 30 minutos");
  });

  it("returns hours for dates within the last day", () => {
    const date = new Date(Date.now() - 5 * 60 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe("hace 5 horas");
  });

  it("returns days for dates older than 24 hours", () => {
    const date = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe("hace 3 días");
  });

  it("uses singular form for 1 unit", () => {
    const date = new Date(Date.now() - 1 * 60 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe("hace 1 hora");
  });
});

describe("formatRelativeShort", () => {
  const ago = (ms: number) => new Date(Date.now() - ms);
  const SEC = 1000, MIN = 60 * SEC, HOUR = 60 * MIN, DAY = 24 * HOUR;

  it("returns '-' for null/undefined", () => {
    expect(formatRelativeShort(null)).toBe("-");
    expect(formatRelativeShort(undefined)).toBe("-");
  });

  it("says 'ahora' under a minute", () => {
    expect(formatRelativeShort(ago(5 * SEC))).toBe("ahora");
    expect(formatRelativeShort(ago(59 * SEC))).toBe("ahora");
  });

  it("uses minutes, hours and days without the 'hace' prefix", () => {
    expect(formatRelativeShort(ago(2 * MIN))).toBe("2 min");
    expect(formatRelativeShort(ago(59 * MIN))).toBe("59 min");
    expect(formatRelativeShort(ago(3 * HOUR))).toBe("3 h");
    expect(formatRelativeShort(ago(23 * HOUR))).toBe("23 h");
    expect(formatRelativeShort(ago(5 * DAY))).toBe("5 d");
    expect(formatRelativeShort(ago(29 * DAY))).toBe("29 d");
  });

  it("falls back to an absolute date past 30 days", () => {
    const old = ago(40 * DAY);
    expect(formatRelativeShort(old)).toBe(formatDate(old));
  });

  it("stays short enough for a post-it footer", () => {
    for (const d of [ago(5 * SEC), ago(45 * MIN), ago(7 * HOUR), ago(12 * DAY)]) {
      expect(formatRelativeShort(d).length).toBeLessThanOrEqual(6);
    }
  });

  it("accepts an ISO string", () => {
    expect(formatRelativeShort(ago(2 * HOUR).toISOString())).toBe("2 h");
  });
});
