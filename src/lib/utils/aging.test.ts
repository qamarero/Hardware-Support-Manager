import { describe, it, expect, vi, afterEach } from "vitest";
import { calculateAging } from "./aging";

describe("calculateAging — legacy signature (only stateChangedAt)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns zero values for null/undefined", () => {
    const result = calculateAging(null);
    expect(result).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      label: "-",
      isOverdue: false,
      mode: "active",
    });
  });

  it("calculates minutes correctly", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T10:45:00Z"));

    const result = calculateAging("2026-03-05T10:00:00Z");
    expect(result.minutes).toBe(45);
    expect(result.hours).toBe(0);
    expect(result.days).toBe(0);
    expect(result.label).toBe("45m");
    expect(result.isOverdue).toBe(false);
    expect(result.mode).toBe("active");
  });

  it("calculates hours and minutes correctly", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T15:30:00Z"));

    const result = calculateAging("2026-03-05T10:00:00Z");
    expect(result.hours).toBe(5);
    expect(result.minutes).toBe(30);
    expect(result.days).toBe(0);
    expect(result.label).toBe("5h 30m");
  });

  it("calculates days correctly", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-08T14:00:00Z"));

    const result = calculateAging("2026-03-05T10:00:00Z");
    expect(result.days).toBe(3);
    expect(result.label).toContain("3d");
  });

  it("marks as overdue when exceeding threshold", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T10:00:00Z"));

    const result = calculateAging("2026-03-05T10:00:00Z", 3);
    expect(result.isOverdue).toBe(true);
  });

  it("is not overdue when within threshold", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-06T10:00:00Z"));

    const result = calculateAging("2026-03-05T10:00:00Z", 3);
    expect(result.isOverdue).toBe(false);
  });

  it("accepts Date objects", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T11:00:00Z"));

    const result = calculateAging(new Date("2026-03-05T10:00:00Z"));
    expect(result.hours).toBe(1);
  });
});

describe("calculateAging — closed mode (frozen at resolvedAt)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("freezes at resolvedAt - createdAt for resolved incidents", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-10T12:00:00Z"));

    const result = calculateAging({
      createdAt: "2026-05-01T10:00:00Z",
      stateChangedAt: "2026-05-08T16:00:00Z",
      resolvedAt: "2026-05-08T16:00:00Z",
      status: "resuelto",
    });

    // 7d 6h desde createdAt a resolvedAt — congelado, no cambia con `now`.
    expect(result.mode).toBe("closed");
    expect(result.days).toBe(7);
    expect(result.hours).toBe(6);
    expect(result.label).toBe("7d 6h");
    expect(result.isOverdue).toBe(false);
  });

  it("does not advance with time when closed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-10T12:00:00Z"));

    const first = calculateAging({
      createdAt: "2026-05-01T10:00:00Z",
      stateChangedAt: "2026-05-08T16:00:00Z",
      resolvedAt: "2026-05-08T16:00:00Z",
      status: "cerrado",
    });

    // Avanzar el reloj 5 días.
    vi.setSystemTime(new Date("2026-05-15T12:00:00Z"));

    const second = calculateAging({
      createdAt: "2026-05-01T10:00:00Z",
      stateChangedAt: "2026-05-08T16:00:00Z",
      resolvedAt: "2026-05-08T16:00:00Z",
      status: "cerrado",
    });

    expect(first.label).toBe(second.label);
    expect(first.days).toBe(second.days);
  });

  it("subtracts slaPausedMs from total time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-10T12:00:00Z"));

    // Caso de 10 días de calendar, 2 días en pausa → 8 días "activos".
    const oneDayMs = 24 * 60 * 60 * 1000;
    const result = calculateAging({
      createdAt: "2026-05-01T10:00:00Z",
      stateChangedAt: "2026-05-11T10:00:00Z",
      resolvedAt: "2026-05-11T10:00:00Z",
      status: "resuelto",
      slaPausedMs: String(2 * oneDayMs),
    });

    expect(result.mode).toBe("closed");
    expect(result.days).toBe(8);
    expect(result.hours).toBe(0);
  });

  it("falls back to stateChangedAt when resolvedAt is null (cancelado)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-10T12:00:00Z"));

    const result = calculateAging({
      createdAt: "2026-05-01T10:00:00Z",
      stateChangedAt: "2026-05-05T14:00:00Z",
      resolvedAt: null,
      status: "cancelado",
    });

    expect(result.mode).toBe("closed");
    expect(result.days).toBe(4);
    expect(result.hours).toBe(4);
  });

  it("respects custom closedStatuses (RMA)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-10T12:00:00Z"));

    const result = calculateAging({
      createdAt: "2026-05-01T10:00:00Z",
      stateChangedAt: "2026-05-04T10:00:00Z",
      status: "recibido_oficina",
      closedStatuses: ["recibido_oficina", "cerrado", "cancelado"],
      pausedStatuses: [],
    });

    expect(result.mode).toBe("closed");
    expect(result.days).toBe(3);
  });
});

describe("calculateAging — paused mode (waiting on external)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("freezes at stateChangedAt - createdAt - slaPausedMs", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-10T12:00:00Z"));

    const result = calculateAging({
      createdAt: "2026-05-01T10:00:00Z",
      stateChangedAt: "2026-05-04T10:00:00Z",
      status: "esperando_cliente",
      slaPausedMs: "0",
    });

    expect(result.mode).toBe("paused");
    expect(result.days).toBe(3);
    expect(result.isOverdue).toBe(false);
  });

  it("does not advance with time when paused", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-10T12:00:00Z"));

    const first = calculateAging({
      createdAt: "2026-05-01T10:00:00Z",
      stateChangedAt: "2026-05-04T10:00:00Z",
      status: "esperando_proveedor",
    });

    vi.setSystemTime(new Date("2026-05-20T12:00:00Z"));

    const second = calculateAging({
      createdAt: "2026-05-01T10:00:00Z",
      stateChangedAt: "2026-05-04T10:00:00Z",
      status: "esperando_proveedor",
    });

    expect(first.label).toBe(second.label);
  });

  it("subtracts previous slaPausedMs from active time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-10T12:00:00Z"));

    const oneDayMs = 24 * 60 * 60 * 1000;
    const result = calculateAging({
      createdAt: "2026-05-01T10:00:00Z",
      stateChangedAt: "2026-05-05T10:00:00Z",
      status: "esperando_cliente",
      slaPausedMs: String(oneDayMs),
    });

    // 4 días entre createdAt y stateChangedAt - 1 día de pausa previa = 3 días activos.
    expect(result.mode).toBe("paused");
    expect(result.days).toBe(3);
  });
});

describe("calculateAging — active mode with rich context", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns mode='active' for ongoing incident", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-05T15:30:00Z"));

    const result = calculateAging({
      createdAt: "2026-05-01T10:00:00Z",
      stateChangedAt: "2026-05-05T10:00:00Z",
      status: "en_gestion",
    });

    expect(result.mode).toBe("active");
    expect(result.hours).toBe(5);
    expect(result.minutes).toBe(30);
  });

  it("active mode honors thresholdDays for isOverdue", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-09T10:00:00Z"));

    const result = calculateAging(
      {
        createdAt: "2026-05-01T10:00:00Z",
        stateChangedAt: "2026-05-05T10:00:00Z",
        status: "en_gestion",
      },
      3,
    );

    expect(result.mode).toBe("active");
    expect(result.days).toBe(4);
    expect(result.isOverdue).toBe(true);
  });
});

describe("calculateAging — defensive defaults", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("treats negative diffMs as zero (data inconsistency)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T10:00:00Z"));

    const result = calculateAging({
      createdAt: "2026-05-05T10:00:00Z",
      stateChangedAt: "2026-05-05T10:00:00Z",
      resolvedAt: "2026-05-05T10:00:00Z",
      status: "resuelto",
    });

    expect(result.days).toBe(0);
    expect(result.label).toBe("0m");
  });

  it("ignores invalid slaPausedMs values", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-10T12:00:00Z"));

    const result = calculateAging({
      createdAt: "2026-05-01T10:00:00Z",
      stateChangedAt: "2026-05-04T10:00:00Z",
      resolvedAt: "2026-05-04T10:00:00Z",
      status: "resuelto",
      slaPausedMs: "not-a-number",
    });

    // Debe ignorar el slaPausedMs malo y dar 3d.
    expect(result.days).toBe(3);
  });
});
